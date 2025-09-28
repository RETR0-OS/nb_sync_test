"""Role management system for user role assignment and persistence."""

import json
import logging
import os
import time
from typing import Dict, Optional, List, Any, Union
from .redis_client import redis_manager

logger = logging.getLogger(__name__)


class RoleManager:
    """Manages user roles with persistence and validation."""

    def __init__(self):
        self.redis_prefix = "nb_sync:roles"
        self.role_config_key = f"{self.redis_prefix}:config"
        self.user_roles_key = f"{self.redis_prefix}:users"
        self.role_history_key = f"{self.redis_prefix}:history"

    async def initialize(self) -> None:
        """Initialize role manager and set up default configuration."""
        try:
            # Set up default configuration if not exists
            await self._ensure_default_config()
            logger.info("Role manager initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize role manager: {e}")
            raise

    async def _ensure_default_config(self) -> None:
        """Ensure default role configuration exists."""
        config_exists = await redis_manager.client.exists(self.role_config_key)

        if not config_exists:
            default_config = {
                'default_role': 'student',
                'available_roles': ['teacher', 'student'],
                'teacher_mode_enabled': False,
                'auto_assign_teacher': False,
                'role_change_allowed': True,
                'created_at': time.time(),
                'updated_at': time.time()
            }

            await redis_manager.client.hset(
                self.role_config_key,
                mapping={k: json.dumps(v) if not isinstance(v, (str, int, float)) else str(v)
                        for k, v in default_config.items()}
            )
            logger.info("Default role configuration created")

    async def set_user_role(self, user_id: str, role: str, assigned_by: Optional[str] = None) -> bool:
        """
        Set role for a specific user.

        Args:
            user_id: User identifier
            role: Role to assign ('teacher' or 'student')
            assigned_by: Who assigned this role (for audit trail)

        Returns:
            True if role was set successfully
        """
        try:
            # Validate role
            if not await self._is_valid_role(role):
                logger.error(f"Invalid role: {role}")
                return False

            # Get current role for history
            current_role = await self.get_user_role(user_id)

            # Set new role
            role_data = {
                'role': role,
                'assigned_at': time.time(),
                'assigned_by': assigned_by or 'system',
                'previous_role': current_role
            }

            await redis_manager.client.hset(
                self.user_roles_key,
                user_id,
                json.dumps(role_data)
            )

            # Add to history
            await self._add_role_history(user_id, current_role, role, assigned_by)

            logger.info(f"Role {role} assigned to user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to set role for user {user_id}: {e}")
            return False

    async def get_user_role(self, user_id: str) -> Optional[str]:
        """
        Get role for a specific user.

        Args:
            user_id: User identifier

        Returns:
            User role or None if not found
        """
        try:
            # First check for explicit role assignment
            role_data_json = await redis_manager.client.hget(self.user_roles_key, user_id)

            if role_data_json:
                role_data = json.loads(role_data_json)
                return role_data.get('role')

            # Check environment-based role assignment
            env_role = await self._get_env_based_role(user_id)
            if env_role:
                return env_role

            # Return default role
            return await self._get_default_role()

        except Exception as e:
            logger.error(f"Failed to get role for user {user_id}: {e}")
            return await self._get_default_role()

    async def _get_env_based_role(self, user_id: str) -> Optional[str]:
        """Get role based on environment configuration."""
        try:
            # Check if teacher mode is enabled globally
            if os.getenv('JUPYTER_TEACHER_MODE', '').lower() in ('true', '1', 'yes'):
                return 'teacher'

            # Check if user is in teacher users list
            teacher_users = os.getenv('JUPYTER_TEACHER_USERS', '').split(',')
            teacher_users = [u.strip() for u in teacher_users if u.strip()]

            if user_id in teacher_users:
                return 'teacher'

            return None

        except Exception as e:
            logger.error(f"Error checking environment-based role: {e}")
            return None

    async def _get_default_role(self) -> str:
        """Get the default role from configuration."""
        try:
            default_role = await redis_manager.client.hget(self.role_config_key, 'default_role')
            return default_role or 'student'
        except Exception:
            return 'student'

    async def _is_valid_role(self, role: str) -> bool:
        """Check if role is valid."""
        try:
            available_roles_json = await redis_manager.client.hget(self.role_config_key, 'available_roles')
            if available_roles_json:
                available_roles = json.loads(available_roles_json)
                return role in available_roles
            return role in ['teacher', 'student']  # fallback
        except Exception:
            return role in ['teacher', 'student']  # fallback

    async def _add_role_history(self, user_id: str, old_role: Optional[str], new_role: str, assigned_by: Optional[str]) -> None:
        """Add role change to history."""
        try:
            history_entry = {
                'user_id': user_id,
                'old_role': old_role,
                'new_role': new_role,
                'assigned_by': assigned_by or 'system',
                'timestamp': time.time()
            }

            # Use Redis list to store history (most recent first)
            await redis_manager.client.lpush(
                f"{self.role_history_key}:{user_id}",
                json.dumps(history_entry)
            )

            # Keep only last 50 history entries per user
            await redis_manager.client.ltrim(f"{self.role_history_key}:{user_id}", 0, 49)

        except Exception as e:
            logger.error(f"Failed to add role history: {e}")

    async def get_user_role_history(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get role change history for a user."""
        try:
            history_items = await redis_manager.client.lrange(
                f"{self.role_history_key}:{user_id}", 0, limit - 1
            )

            return [json.loads(item) for item in history_items]

        except Exception as e:
            logger.error(f"Failed to get role history for user {user_id}: {e}")
            return []

    async def list_users_by_role(self, role: str) -> List[Dict[str, Any]]:
        """List all users with a specific role."""
        try:
            all_users = await redis_manager.client.hgetall(self.user_roles_key)
            users_with_role = []

            for user_id, role_data_json in all_users.items():
                try:
                    role_data = json.loads(role_data_json)
                    if role_data.get('role') == role:
                        users_with_role.append({
                            'user_id': user_id,
                            'assigned_at': role_data.get('assigned_at'),
                            'assigned_by': role_data.get('assigned_by')
                        })
                except json.JSONDecodeError:
                    continue

            return users_with_role

        except Exception as e:
            logger.error(f"Failed to list users by role {role}: {e}")
            return []

    async def remove_user_role(self, user_id: str, removed_by: Optional[str] = None) -> bool:
        """Remove explicit role assignment for a user (they'll get default role)."""
        try:
            # Get current role for history
            current_role = await self.get_user_role(user_id)

            # Remove from explicit assignments
            await redis_manager.client.hdel(self.user_roles_key, user_id)

            # Add to history
            default_role = await self._get_default_role()
            await self._add_role_history(user_id, current_role, default_role, removed_by)

            logger.info(f"Role assignment removed for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to remove role for user {user_id}: {e}")
            return False

    async def update_role_config(self, config_updates: Dict[str, Any], updated_by: Optional[str] = None) -> bool:
        """Update role configuration."""
        try:
            # Validate config updates
            valid_keys = {
                'default_role', 'available_roles', 'teacher_mode_enabled',
                'auto_assign_teacher', 'role_change_allowed'
            }

            for key in config_updates:
                if key not in valid_keys:
                    logger.error(f"Invalid config key: {key}")
                    return False

            # Add metadata
            config_updates['updated_at'] = time.time()
            if updated_by:
                config_updates['updated_by'] = updated_by

            # Update configuration
            config_mapping = {
                k: json.dumps(v) if not isinstance(v, (str, int, float)) else str(v)
                for k, v in config_updates.items()
            }

            await redis_manager.client.hset(self.role_config_key, mapping=config_mapping)

            logger.info(f"Role configuration updated: {list(config_updates.keys())}")
            return True

        except Exception as e:
            logger.error(f"Failed to update role configuration: {e}")
            return False

    async def get_role_config(self) -> Dict[str, Any]:
        """Get current role configuration."""
        try:
            config_data = await redis_manager.client.hgetall(self.role_config_key)

            config = {}
            for key, value in config_data.items():
                try:
                    # Try to parse as JSON first
                    config[key] = json.loads(value)
                except json.JSONDecodeError:
                    # Fall back to string value
                    config[key] = value

            return config

        except Exception as e:
            logger.error(f"Failed to get role configuration: {e}")
            return {}

    async def validate_role_assignment(self, user_id: str, required_role: str) -> Dict[str, Any]:
        """
        Validate if user has required role and return detailed info.

        Returns:
            Dict with validation result and user role info
        """
        try:
            user_role = await self.get_user_role(user_id)

            result = {
                'user_id': user_id,
                'current_role': user_role,
                'required_role': required_role,
                'has_required_role': user_role == required_role,
                'is_valid_role': await self._is_valid_role(user_role) if user_role else False
            }

            # Add role source information
            explicit_role = await redis_manager.client.hget(self.user_roles_key, user_id)
            if explicit_role:
                role_data = json.loads(explicit_role)
                result['role_source'] = 'explicit'
                result['assigned_at'] = role_data.get('assigned_at')
                result['assigned_by'] = role_data.get('assigned_by')
            elif await self._get_env_based_role(user_id):
                result['role_source'] = 'environment'
            else:
                result['role_source'] = 'default'

            return result

        except Exception as e:
            logger.error(f"Failed to validate role assignment for user {user_id}: {e}")
            return {
                'user_id': user_id,
                'current_role': None,
                'required_role': required_role,
                'has_required_role': False,
                'is_valid_role': False,
                'error': str(e)
            }


# Global role manager instance
role_manager = RoleManager()