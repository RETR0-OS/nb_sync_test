# jupyter_notebook_sync/handlers.py
import json
import logging
from typing import Any, Dict, Optional

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from tornado import web

from .redis_client import redis_manager
from .session_manager import session_service

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
        # Authentication-free: only use a caller-provided header; otherwise default
        return self.request.headers.get("X-Client-Id", "anonymous")


class StatusHandler(JsonAPIHandler):
    async def get(self):
        try:
            await redis_manager.client.ping()
            redis_status = "connected"
        except Exception as e:
            redis_status = f"error: {e}"
        payload = {
            "extension": "jupyter-notebook-sync",
            "status": "running",
            "redis": redis_status,
        }
        self.finish(json.dumps(payload))


class SessionCreateHandler(JsonAPIHandler):
    # Authentication disabled
    async def post(self):
        # Identity is ignored while auth is disabled
        code = await session_service.create_session()
        self.set_status(201)
        self.finish(json.dumps({"type": "session_created", "session_code": code, "role": "teacher"}))


class SessionJoinHandler(JsonAPIHandler):
    # Authentication disabled
    async def post(self, code: str):
        student_id = self.requester_id()
        ok = await session_service.join_session(code, student_id)
        if not ok:
            self.set_status(404)
            self.finish(json.dumps({"type": "error", "message": "Session not found or inactive"}))
            return
        self.finish(json.dumps({"type": "session_joined", "session_code": code, "role": "student"}))


class SessionEndHandler(JsonAPIHandler):
    # Authentication disabled
    async def delete(self, code: str):
        # Ideally verify teacher identity versus session owner here
        await session_service.end_session(code)
        self.finish(json.dumps({"type": "session_ended", "session_code": code}))


class PushCellHandler(JsonAPIHandler):
    # Authentication disabled
    async def post(self, code: str, cell_id: str):
        data = self.get_json()
        content = data.get("content")
        metadata = data.get("metadata", {})
        if content is None:
            self.set_status(400)
            self.finish(json.dumps({"type": "error", "message": "content is required"}))
            return
        ts = await session_service.push_cell(code, cell_id, content, metadata)
        self.finish(json.dumps({"type": "push_confirmed", "cell_id": cell_id, "timestamp": ts}))


class ToggleSyncHandler(JsonAPIHandler):
    # Authentication disabled
    async def post(self, code: str, cell_id: str):
        data = self.get_json()
        if "sync_allowed" not in data:
            self.set_status(400)
            self.finish(json.dumps({"type": "error", "message": "sync_allowed is required"}))
            return
        sync_allowed = bool(data["sync_allowed"])
        ts = await session_service.toggle_sync(code, cell_id, sync_allowed)
        self.finish(json.dumps({"type": "sync_allowed_update", "cell_id": cell_id, "sync_allowed": sync_allowed, "timestamp": ts}))


class NotificationsHandler(JsonAPIHandler):
    # Authentication disabled
    async def get(self, code: str):
        # since as float seconds; default to 0 for first poll
        since_param = self.get_query_argument("since", default="0")
        try:
            since_ts = float(since_param)
        except ValueError:
            self.set_status(400)
            self.finish(json.dumps({"type": "error", "message": "invalid since parameter"}))
            return
        items = await session_service.list_notifications(code, since_ts)
        self.finish(json.dumps({"type": "notifications", "items": items}))


class PendingCellHandler(JsonAPIHandler):
    # Authentication disabled
    async def get(self, code: str, cell_id: str):
        status = await session_service.get_pending_status(code, cell_id)
        self.finish(json.dumps({"type": "pending_status", "cell_id": cell_id, **status}))


class RequestSyncHandler(JsonAPIHandler):
    # Authentication disabled
    async def post(self, code: str, cell_id: str):
        result = await session_service.request_sync(code, cell_id)
        if not result:
            self.set_status(404)
            self.finish(json.dumps({"type": "error", "message": "No pending update available or sync not allowed"}))
            return
        self.finish(json.dumps(result))


def setup_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]
    api_base = url_path_join(base_url, "notebook-sync")

    handlers = [
        (url_path_join(api_base, "status"), StatusHandler),
        (url_path_join(api_base, "sessions"), SessionCreateHandler),  # POST
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "join"), SessionJoinHandler),  # POST
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)"), SessionEndHandler),  # DELETE
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "cells", r"(?P<cell_id>[^/]+)", "push"), PushCellHandler),  # POST
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "cells", r"(?P<cell_id>[^/]+)", "toggle"), ToggleSyncHandler),  # POST
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "notifications"), NotificationsHandler),  # GET
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "cells", r"(?P<cell_id>[^/]+)", "pending"), PendingCellHandler),  # GET
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "cells", r"(?P<cell_id>[^/]+)", "request-sync"), RequestSyncHandler),  # POST
    ]
    web_app.add_handlers(host_pattern, handlers)
    logger.info("Notebook Sync REST handlers registered at %s", api_base)
