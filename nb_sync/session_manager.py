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
    # async def create_session(self, teacher_id: str) -> str:
    async def create_session(self) -> str:
        # Ensure unique code
        code = _gen_code()
        while await redis_manager.get_session(code):
            code = _gen_code()
        await redis_manager.create_session(code)
        logger.info("Session %s created", code)
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

    async def toggle_sync(self, code: str, cell_id: str, sync_allowed: bool) -> float:
        ts = await redis_manager.update_sync_allowed(code, cell_id, sync_allowed)
        logger.info("Toggled sync_allowed=%s for %s/%s at %s", sync_allowed, code, cell_id, ts)
        return ts

    async def list_notifications(self, code: str, since_ts: float) -> List[Dict[str, Any]]:
        return await redis_manager.list_notifications(code, since_ts)

    async def get_pending_status(self, code: str, cell_id: str) -> Dict[str, Any]:
        upd = await redis_manager.get_pending_update(code, cell_id)
        if not upd:
            return {"available": False}
        return {
            "available": True,
            "timestamp": upd["timestamp"],
            "sync_allowed": bool(upd["metadata"].get("sync_allowed", True)),
        }

    async def request_sync(self, code: str, cell_id: str) -> Optional[Dict[str, Any]]:
        upd = await redis_manager.get_pending_update(code, cell_id)
        if not upd:
            return None
        if not bool(upd["metadata"].get("sync_allowed", True)):
            return None
        return {
            "type": "cell_content_update",
            "cell_id": cell_id,
            "content": upd["content"],
            "metadata": upd["metadata"],
            "timestamp": upd["timestamp"],
        }


session_service = SessionService()
