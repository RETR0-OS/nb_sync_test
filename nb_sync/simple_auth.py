"""
Simple environment-based role determination.
Replaces the complex authentication system with environment variable checks.
"""

import os
from typing import Dict, Any


def get_user_role() -> str:
    """Get user role from environment variable only."""
    return 'teacher' if os.getenv('JUPYTER_TEACHER_MODE', '').lower() in ('true', '1', 'yes') else 'student'


def get_role_config() -> Dict[str, Any]:
    """Return simple role configuration."""
    return {
        'default_role': get_user_role(),
        'available_roles': ['teacher', 'student'],
        'role_source': 'environment',
        'auth_method': 'none'
    }


def is_teacher() -> bool:
    """Check if current environment is configured for teacher mode."""
    return get_user_role() == 'teacher'


def is_student() -> bool:
    """Check if current environment is configured for student mode."""
    return get_user_role() == 'student'