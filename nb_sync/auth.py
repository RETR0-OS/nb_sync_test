"""Authentication and authorization module for Jupyter session validation."""

import functools
import json
import logging
import os
from typing import Dict, Any, Optional, Callable, Awaitable
from jupyter_server.auth import User
from jupyter_server.base.handlers import APIHandler
from tornado import web

logger = logging.getLogger(__name__)


class AuthenticationError(Exception):
    """Raised when authentication fails."""
    pass


class AuthorizationError(Exception):
    """Raised when authorization fails."""
    pass


def extract_user_id_from_jupyter_session(handler: APIHandler) -> Optional[str]:
    """
    Extract user ID from Jupyter session.

    This function leverages Jupyter's built-in authentication system
    to identify the current user.
    """
    try:
        # Method 1: Try to get user from Jupyter's current_user
        if hasattr(handler, 'current_user') and handler.current_user:
            user = handler.current_user
            if isinstance(user, User):
                # Jupyter User object has username
                return user.username
            elif isinstance(user, dict):
                # Sometimes it's a dict with user info
                return user.get('name') or user.get('username') or user.get('login')
            elif isinstance(user, str):
                # Sometimes it's just a string
                return user
        return None

    except Exception as e:
        logger.error(f"Error extracting user ID from session: {e}")
        return None


def validate_jupyter_session(handler: APIHandler) -> Dict[str, Any]:
    """
    Validate the current Jupyter session and extract user information.

    Returns:
        Dict containing user_id, session_valid, and any additional info
    """
    try:
        # Extract user ID using various methods
        user_id = extract_user_id_from_jupyter_session(handler)

        # Optional: add debug flag via env to log user extraction path
        if os.getenv('DEBUG_USER_EXTRACTION', '').lower() in ('true', '1', 'yes'):
            logger.debug(f"User ID extracted: {user_id}")

        if not user_id:
            return {
                'session_valid': False,
                'user_id': None,
                'error': 'Could not extract user ID from session'
            }

        # Validate session is actually active
        # In a real implementation, you might check session expiry, tokens, etc.
        session_valid = True

        # Additional validation could include:
        # - Checking session timeout
        # - Validating CSRF tokens
        # - Checking user permissions in Jupyter

        return {
            'session_valid': session_valid,
            'user_id': user_id,
            'authenticated': True
        }

    except Exception as e:
        logger.error(f"Session validation failed: {e}")
        return {
            'session_valid': False,
            'user_id': None,
            'error': str(e)
        }


async def get_user_role(user_id: str) -> Optional[str]:
    """
    Get user role from role configuration using role manager.
    """
    from .role_manager import role_manager
    try:
        return await role_manager.get_user_role(user_id)
    except Exception as e:
        logger.error(f"Error getting user role: {e}")
        # Fallback to environment-based role assignment
        if os.getenv('JUPYTER_TEACHER_MODE', '').lower() in ('true', '1', 'yes'):
            return 'teacher'
        return 'student'


def authenticated(required_role: Optional[str] = None):
    """
    Decorator to require authentication and optionally a specific role.

    Args:
        required_role: If specified, user must have this role ('teacher' or 'student')
    """
    def decorator(method: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        @functools.wraps(method)
        async def wrapper(self: APIHandler, *args, **kwargs):
            try:
                # Validate Jupyter session
                session_info = validate_jupyter_session(self)

                if not session_info.get('session_valid'):
                    error_msg = session_info.get('error', 'Invalid session')
                    logger.warning(f"Authentication failed: {error_msg}")
                    self.set_status(401)
                    self.finish(json.dumps({
                        'type': 'error',
                        'message': 'Authentication required',
                        'detail': error_msg
                    }))
                    return

                user_id = session_info['user_id']

                # Get user role
                user_role = await get_user_role(user_id)

                if not user_role:
                    logger.warning(f"No role found for user: {user_id}")
                    self.set_status(403)
                    self.finish(json.dumps({
                        'type': 'error',
                        'message': 'No role assigned'
                    }))
                    return

                # Check role requirement
                if required_role and user_role != required_role:
                    logger.warning(f"Role mismatch: user {user_id} has role {user_role}, required {required_role}")
                    self.set_status(403)
                    self.finish(json.dumps({
                        'type': 'error',
                        'message': f'Role {required_role} required, but user has {user_role}'
                    }))
                    return

                # Store authentication info in handler for use in method
                self._auth_info = {
                    'user_id': user_id,
                    'role': user_role,
                    'authenticated': True
                }

                # Call the original method
                return await method(self, *args, **kwargs)

            except Exception as e:
                logger.error(f"Authentication decorator error: {e}")
                self.set_status(500)
                self.finish(json.dumps({
                    'type': 'error',
                    'message': 'Authentication error',
                    'detail': str(e)
                }))

        return wrapper
    return decorator


def get_current_user_info(handler: APIHandler) -> Dict[str, Any]:
    """
    Get current user authentication info from handler.

    This should be called after the @authenticated decorator has run.
    """
    return getattr(handler, '_auth_info', {
        'user_id': None,
        'role': None,
        'authenticated': False
    })


def teacher_required(method: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
    """Decorator shorthand for requiring teacher role."""
    return authenticated('teacher')(method)


def student_required(method: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
    """Decorator shorthand for requiring student role."""
    return authenticated('student')(method)


class AuthValidationHandler(APIHandler):
    """Handler for validating authentication and returning user info."""

    @authenticated()
    async def get(self):
        """Validate current session and return user info."""
        user_info = get_current_user_info(self)

        response = {
            'authenticated': user_info['authenticated'],
            'user_id': user_info['user_id'],
            'role': user_info['role']
        }

        self.finish(json.dumps(response))

        # Log successful authentication
        logger.info(f"Authentication validated for user {user_info['user_id']} with role {user_info['role']}")