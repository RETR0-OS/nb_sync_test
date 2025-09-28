# jupyter_notebook_sync/handlers.py
import json
import logging
from typing import Any, Dict, Optional

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from tornado import web

from .auth import authenticated, teacher_required, student_required, get_current_user_info, AuthValidationHandler
from .redis_client import redis_manager
from .session_manager import session_service
from .role_manager import role_manager

logger = logging.getLogger(__name__)


class JsonAPIHandler(APIHandler):
    def prepare(self):
        self.set_header("Content-Type", "application/json")

    def get_json(self) -> Dict[str, Any]:
        try:
            data = self.get_json_body()
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def requester_id(self) -> str:
        # Get authenticated user ID, fall back to header or anonymous
        user_info = get_current_user_info(self)
        if user_info.get('authenticated') and user_info.get('user_id'):
            return user_info['user_id']
        return self.request.headers.get("X-Client-Id", "anonymous")


class StatusHandler(JsonAPIHandler):
    @authenticated()
    async def get(self):
        try:
            await redis_manager.client.ping()
            redis_status = "connected"
        except Exception as e:
            redis_status = f"error: {e}"

        user_info = get_current_user_info(self)
        payload = {
            "extension": "jupyter-notebook-sync",
            "status": "running",
            "redis": redis_status,
            "user": {
                "user_id": user_info.get('user_id'),
                "role": user_info.get('role'),
                "authenticated": user_info.get('authenticated', False)
            }
        }
        self.finish(json.dumps(payload))


class SessionCreateHandler(JsonAPIHandler):
    @teacher_required
    async def post(self):
        user_info = get_current_user_info(self)
        teacher_id = user_info['user_id']

        code = await session_service.create_session(teacher_id)
        self.set_status(201)
        self.finish(json.dumps({
            "type": "session_created",
            "session_code": code,
            "role": "teacher",
            "teacher_id": teacher_id
        }))


class SessionJoinHandler(JsonAPIHandler):
    @student_required
    async def post(self, code: str):
        user_info = get_current_user_info(self)
        student_id = user_info['user_id']

        ok = await session_service.join_session(code, student_id)
        if not ok:
            self.set_status(404)
            self.finish(json.dumps({"type": "error", "message": "Session not found or inactive"}))
            return
        self.finish(json.dumps({
            "type": "session_joined",
            "session_code": code,
            "role": "student",
            "student_id": student_id
        }))


class SessionEndHandler(JsonAPIHandler):
    @teacher_required
    async def delete(self, code: str):
        user_info = get_current_user_info(self)
        teacher_id = user_info['user_id']

        # Verify teacher owns this session
        session_valid = await session_service.verify_session_owner(code, teacher_id)
        if not session_valid:
            self.set_status(403)
            self.finish(json.dumps({"type": "error", "message": "Not authorized to end this session"}))
            return

        await session_service.end_session(code)
        self.finish(json.dumps({"type": "session_ended", "session_code": code}))


class SessionValidateHandler(JsonAPIHandler):
    @authenticated()
    async def get(self, code: str):
        session_info = await session_service.get_session_status(code)
        if not session_info:
            self.set_status(404)
            self.finish(json.dumps({"type": "error", "message": "Session not found"}))
            return

        self.finish(json.dumps({
            "type": "session_status",
            "session_code": code,
            "status": session_info["status"],
            "teacher_id": session_info["teacher_id"]
        }))


class PushCellHandler(JsonAPIHandler):
    @teacher_required
    async def post(self, code: str, cell_id: str):
        user_info = get_current_user_info(self)
        teacher_id = user_info['user_id']

        # Verify teacher owns this session
        session_valid = await session_service.verify_session_owner(code, teacher_id)
        if not session_valid:
            self.set_status(403)
            self.finish(json.dumps({"type": "error", "message": "Not authorized to push to this session"}))
            return

        data = self.get_json()
        content = data.get("content")
        metadata = data.get("metadata", {})
        if content is None:
            self.set_status(400)
            self.finish(json.dumps({"type": "error", "message": "content is required"}))
            return

        # Add teacher ID to metadata
        metadata['pushed_by'] = teacher_id

        ts = await session_service.push_cell(code, cell_id, content, metadata)
        self.finish(json.dumps({"type": "push_confirmed", "cell_id": cell_id, "timestamp": ts}))


class ToggleSyncHandler(JsonAPIHandler):
    @teacher_required
    async def post(self, code: str, cell_id: str):
        user_info = get_current_user_info(self)
        teacher_id = user_info['user_id']

        # Verify teacher owns this session
        session_valid = await session_service.verify_session_owner(code, teacher_id)
        if not session_valid:
            self.set_status(403)
            self.finish(json.dumps({"type": "error", "message": "Not authorized to modify this session"}))
            return

        data = self.get_json()
        if "sync_allowed" not in data:
            self.set_status(400)
            self.finish(json.dumps({"type": "error", "message": "sync_allowed is required"}))
            return

        sync_allowed = bool(data["sync_allowed"])
        ts = await session_service.toggle_sync(code, cell_id, sync_allowed, teacher_id)
        self.finish(json.dumps({
            "type": "sync_allowed_update",
            "cell_id": cell_id,
            "sync_allowed": sync_allowed,
            "timestamp": ts
        }))


class NotificationsHandler(JsonAPIHandler):
    @authenticated()
    async def get(self, code: str):
        user_info = get_current_user_info(self)
        user_id = user_info['user_id']

        # Verify user is in this session
        session_valid = await session_service.verify_user_in_session(code, user_id)
        if not session_valid:
            self.set_status(403)
            self.finish(json.dumps({"type": "error", "message": "Not authorized to access this session"}))
            return

        # since as float seconds; default to 0 for first poll
        since_param = self.get_query_argument("since", default="0")
        try:
            since_ts = float(since_param)
        except ValueError:
            self.set_status(400)
            self.finish(json.dumps({"type": "error", "message": "invalid since parameter"}))
            return

        items = await session_service.list_notifications(code, since_ts, user_id)
        self.finish(json.dumps({"type": "notifications", "items": items}))


class PendingCellHandler(JsonAPIHandler):
    @authenticated()
    async def get(self, code: str, cell_id: str):
        user_info = get_current_user_info(self)
        user_id = user_info['user_id']

        # Verify user is in this session
        session_valid = await session_service.verify_user_in_session(code, user_id)
        if not session_valid:
            self.set_status(403)
            self.finish(json.dumps({"type": "error", "message": "Not authorized to access this session"}))
            return

        status = await session_service.get_pending_status(code, cell_id, user_id)
        self.finish(json.dumps({"type": "pending_status", "cell_id": cell_id, **status}))


class RequestSyncHandler(JsonAPIHandler):
    @student_required
    async def post(self, code: str, cell_id: str):
        user_info = get_current_user_info(self)
        student_id = user_info['user_id']

        # Verify student is in this session
        session_valid = await session_service.verify_user_in_session(code, student_id)
        if not session_valid:
            self.set_status(403)
            self.finish(json.dumps({"type": "error", "message": "Not authorized to access this session"}))
            return

        result = await session_service.request_sync(code, cell_id, student_id)
        if not result:
            self.set_status(404)
            self.finish(json.dumps({"type": "error", "message": "No pending update available or sync not allowed"}))
            return

        self.finish(json.dumps(result))


# New hash-based read handlers
class HashKeysListHandler(JsonAPIHandler):
    @authenticated()
    async def get(self):
        # Optional query params for pagination and matching
        cursor_param = self.get_query_argument("cursor", default="0")
        count_param = self.get_query_argument("count", default="500")
        match_param = self.get_query_argument("match", default=None)
        teacher_ip = self.get_query_argument("teacher_ip", default=None)

        try:
            cursor = int(cursor_param)
            count = int(count_param)
        except ValueError:
            self.set_status(400)
            self.finish(json.dumps({"type": "error", "message": "invalid cursor or count"}))
            return

        result = await redis_manager.list_cell_hash_keys(
            cursor=cursor,
            match=match_param,
            count=count,
            redis_url_override=f"redis://{teacher_ip}:6379" if teacher_ip else None,
        )
        self.finish(json.dumps({"type": "hash_keys", **result}))


class HashKeyContentHandler(JsonAPIHandler):
    @authenticated()
    async def get(self, hash_key: str):
        teacher_ip = self.get_query_argument("teacher_ip", default=None)
        data = await redis_manager.get_cell_by_hash(
            hash_key=hash_key,
            redis_url_override=f"redis://{teacher_ip}:6379" if teacher_ip else None,
        )
        if not data:
            self.set_status(404)
            self.finish(json.dumps({"type": "error", "message": "not found"}))
            return
        self.finish(json.dumps({"type": "hash_key_content", "key": hash_key, **data}))


# Hash-based cell storage handlers (new specification)

class PushCellHashHandler(JsonAPIHandler):
    """
    Handler for hash-based cell pushing (new specification).
    Teacher pushes cell content with cell_id and created_at timestamp.
    """
    @teacher_required
    async def post(self):
        user_info = get_current_user_info(self)
        teacher_id = user_info['user_id']

        data = self.get_json()
        cell_id = data.get("cell_id")
        created_at = data.get("created_at")
        content = data.get("content")
        ttl_seconds = data.get("ttl_seconds", 86400)  # Default 24 hours

        if not cell_id or not created_at or content is None:
            self.set_status(400)
            self.finish(json.dumps({
                "type": "error", 
                "message": "cell_id, created_at, and content are required"
            }))
            return

        hash_key = await session_service.push_cell_hash(cell_id, created_at, content, ttl_seconds)
        self.finish(json.dumps({
            "type": "push_confirmed_hash",
            "cell_id": cell_id,
            "created_at": created_at,
            "hash_key": hash_key[:8],  # Only show first 8 chars for security
            "teacher_id": teacher_id
        }))


class RequestCellSyncHashHandler(JsonAPIHandler):
    """
    Handler for hash-based cell sync requests (new specification).
    Student requests cell content using cell_id and created_at timestamp.
    """
    @student_required
    async def post(self):
        user_info = get_current_user_info(self)
        student_id = user_info['user_id']

        data = self.get_json()
        cell_id = data.get("cell_id")
        created_at = data.get("created_at")

        if not cell_id or not created_at:
            self.set_status(400)
            self.finish(json.dumps({
                "type": "error",
                "message": "cell_id and created_at are required"
            }))
            return

        cell_data = await session_service.request_cell_sync_hash(cell_id, created_at)
        if not cell_data:
            self.set_status(404)
            self.finish(json.dumps({
                "type": "error",
                "message": "Cell content not found for the specified cell_id and created_at"
            }))
            return

        self.finish(json.dumps({
            "type": "cell_sync_hash",
            "cell_id": cell_id,
            "content": cell_data["content"],
            "created_at": cell_data["created_at"],
            "student_id": student_id
        }))


def setup_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]
    api_base = url_path_join(base_url, "notebook-sync")

    handlers = [
        (url_path_join(api_base, "auth", "validate"), AuthValidationHandler),  # GET
        (url_path_join(api_base, "status"), StatusHandler),
        (url_path_join(api_base, "sessions"), SessionCreateHandler),  # POST
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "join"), SessionJoinHandler),  # POST
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)"), SessionEndHandler),  # DELETE
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "status"), SessionValidateHandler),  # GET
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "cells", r"(?P<cell_id>[^/]+)", "push"), PushCellHandler),  # POST
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "cells", r"(?P<cell_id>[^/]+)", "toggle"), ToggleSyncHandler),  # POST
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "notifications"), NotificationsHandler),  # GET
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "cells", r"(?P<cell_id>[^/]+)", "pending"), PendingCellHandler),  # GET
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "cells", r"(?P<cell_id>[^/]+)", "request-sync"), RequestSyncHandler),  # POST
        
        # New hash-based handlers (new specification)
        (url_path_join(api_base, "hash", "push-cell"), PushCellHashHandler),  # POST
        (url_path_join(api_base, "hash", "request-sync"), RequestCellSyncHashHandler),  # POST
        # Read APIs for listing and previewing by hash
        (url_path_join(api_base, "hash", "keys"), HashKeysListHandler),  # GET
        (url_path_join(api_base, "hash", "key", r"(?P<hash_key>[a-f0-9]{64})"), HashKeyContentHandler),  # GET
    ]
    web_app.add_handlers(host_pattern, handlers)
    logger.info("Notebook Sync REST handlers registered at %s", api_base)
