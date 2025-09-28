# jupyter_notebook_sync/session_manager.py
import json
import logging
import secrets
import string
from typing import Optional, Dict, Any, List

from .redis_client import redis_manager

logger = logging.getLogger(__name__)


def _gen_code(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


class SessionService:
    async def create_session(self, teacher_id: str = None) -> str:
        # Ensure unique code
        code = _gen_code()
        while await redis_manager.get_session(code):
            code = _gen_code()
        await redis_manager.create_session(code, teacher_id)
        logger.info("Session %s created by teacher %s", code, teacher_id)
        return code

    async def join_session(self, code: str, student_id: str) -> bool:
        ok = await redis_manager.add_student(code, student_id)
        if ok:
            logger.info("Student %s joined session %s", student_id, code)
        return ok

    async def end_session(self, code: str) -> None:
        await redis_manager.end_session(code)
        logger.info("Session %s ended", code)

    async def push_cell(self, code: str, cell_id: str, content: Dict[str, Any], metadata: Dict[str, Any]) -> float:
        ts = await redis_manager.store_pending_update(code, cell_id, content, metadata)
        logger.info("Pushed update for %s/%s at %s", code, cell_id, ts)
        return ts

    async def toggle_sync(self, code: str, cell_id: str, sync_allowed: bool, teacher_id: str = None) -> float:
        ts = await redis_manager.update_sync_allowed(code, cell_id, sync_allowed)
        logger.info("Toggled sync_allowed=%s for %s/%s at %s by teacher %s", sync_allowed, code, cell_id, ts, teacher_id)
        return ts

    async def list_notifications(self, code: str, since_ts: float, user_id: str = None) -> List[Dict[str, Any]]:
        notifications = await redis_manager.list_notifications(code, since_ts)
        # Filter notifications based on user role if needed
        # For now, return all notifications - can be enhanced later
        return notifications

    async def get_pending_status(self, code: str, cell_id: str, user_id: str = None) -> Dict[str, Any]:
        upd = await redis_manager.get_pending_update(code, cell_id)
        if not upd:
            return {"available": False}
        return {
            "available": True,
            "timestamp": upd["timestamp"],
            "sync_allowed": bool(upd["metadata"].get("sync_allowed", True)),
        }

    async def request_sync(self, code: str, cell_id: str, student_id: str = None) -> Optional[Dict[str, Any]]:
        upd = await redis_manager.get_pending_update(code, cell_id)
        if not upd:
            return None
        if not bool(upd["metadata"].get("sync_allowed", True)):
            return None

        logger.info("Student %s requested sync for %s/%s", student_id, code, cell_id)
        return {
            "type": "cell_content_update",
            "cell_id": cell_id,
            "content": upd["content"],
            "metadata": upd["metadata"],
            "timestamp": upd["timestamp"],
        }

    async def verify_session_owner(self, code: str, teacher_id: str) -> bool:
        """Verify that the teacher owns this session."""
        try:
            session = await redis_manager.get_session(code)
            if not session:
                return False
            return session.get("teacher_id") == teacher_id
        except Exception as e:
            logger.error(f"Error verifying session owner: {e}")
            return False

    async def verify_user_in_session(self, code: str, user_id: str) -> bool:
        """Verify that the user is part of this session (either teacher or student)."""
        try:
            session = await redis_manager.get_session(code)
            if not session:
                return False

            # Check if user is the teacher
            if session.get("teacher_id") == user_id:
                return True

            # Check if user is in students list
            students = session.get("students", [])
            if isinstance(students, str):
                try:
                    students = json.loads(students)
                except json.JSONDecodeError:
                    students = []

            return user_id in students

        except Exception as e:
            logger.error(f"Error verifying user in session: {e}")
            return False


session_service = SessionService()
