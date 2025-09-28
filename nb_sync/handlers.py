# jupyter_notebook_sync/handlers.py
import json
import logging
import os
import socket
import time
from typing import Any, Dict, Optional

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from tornado import web

from .redis_client import redis_manager
from .session_manager import session_service

logger = logging.getLogger(__name__)


def get_current_role() -> str:
    """Get current user role - hard-coded as teacher (change to 'student' for student instances)."""
    return 'teacher'  # Change this to 'student' for student instances


def get_machine_id(handler) -> str:
    """Generate machine-based identifier instead of user ID."""
    remote_ip = handler.request.remote_ip or 'localhost'
    return f"machine_{remote_ip}_{int(time.time())}"


def _get_private_ipv4_addresses() -> list[str]:
    """Return sorted list of private (RFC1918) IPv4 addresses for this host."""
    ips = set()
    try:
        hostname = socket.gethostname()
        # gethostbyname_ex
        try:
            for ip in socket.gethostbyname_ex(hostname)[2]:
                ips.add(ip)
        except Exception:
            pass
        # getaddrinfo
        try:
            for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
                ip = info[4][0]
                ips.add(ip)
        except Exception:
            pass
        # Filter to private ranges
        def is_private(ip: str) -> bool:
            return (
                ip.startswith("10.")
                or ip.startswith("192.168.")
                or (ip.startswith("172.") and 16 <= int(ip.split(".")[1]) <= 31)
            )
        private_ips = sorted(ip for ip in ips if is_private(ip))
        return private_ips
    except Exception:
        return []


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
        # Simple machine-based identifier
        return get_machine_id(self)


class StatusHandler(JsonAPIHandler):
    async def get(self):
        try:
            await redis_manager.client.ping()
            redis_status = "connected"
            redis_info = await redis_manager.client.info()
            redis_version = redis_info.get('redis_version', 'unknown')
        except Exception as e:
            redis_status = f"error: {e}"
            redis_version = "unknown"

        current_role = get_current_role()

        payload = {
            "extension": "nb-sync",
            "status": "running",
            "role": current_role,
            "redis": {
                "status": redis_status,
                "version": redis_version,
                "url": redis_manager.redis_url,
                "docker": True
            },
            "network_mode": "docker_redis",
            "machine_id": get_machine_id(self)
        }
        self.finish(json.dumps(payload))


class RoleHandler(JsonAPIHandler):
    """Handler to get current user role from backend (environment-based)"""
    async def get(self):
        current_role = get_current_role()
        machine_id = get_machine_id(self)

        payload = {
            "type": "role_info",
            "role": current_role,
            "role_source": "hard_coded",
            "config_note": "Change get_current_role() return value to 'student' for student instances",
            "machine_id": machine_id
        }
        self.finish(json.dumps(payload))


class SessionCreateHandler(JsonAPIHandler):
    async def post(self):
        # Simple session creation without authentication
        machine_id = get_machine_id(self)

        code = await session_service.create_session(machine_id)
        print("session code:", code)
        self.set_status(201)
        self.finish(json.dumps({
            "type": "session_created",
            "session_code": code,
            "role": get_current_role(),
            "machine_id": machine_id
        }))


class SessionJoinHandler(JsonAPIHandler):
    async def post(self, code: str):
        # Simple session joining without authentication
        machine_id = get_machine_id(self)

        ok = await session_service.join_session(code, machine_id)
        if not ok:
            self.set_status(404)
            self.finish(json.dumps({"type": "error", "message": "Session not found or inactive"}))
            return
        self.finish(json.dumps({
            "type": "session_joined",
            "session_code": code,
            "role": get_current_role(),
            "machine_id": machine_id
        }))


class SessionEndHandler(JsonAPIHandler):
    async def delete(self, code: str):
        # Anyone can end a session - no ownership verification
        await session_service.end_session(code)
        self.finish(json.dumps({
            "type": "session_ended",
            "session_code": code,
            "ended_by": get_machine_id(self)
        }))


class SessionValidateHandler(JsonAPIHandler):
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
            "teacher_id": session_info["teacher_id"],
            "requested_by": get_machine_id(self)
        }))


class PushCellHandler(JsonAPIHandler):
    async def post(self, code: str, cell_id: str):
        machine_id = get_machine_id(self)

        data = self.get_json()
        content = data.get("content")
        metadata = data.get("metadata", {})
        if content is None:
            self.set_status(400)
            self.finish(json.dumps({"type": "error", "message": "content is required"}))
            return

        # Add machine ID to metadata
        metadata['pushed_by'] = machine_id
        metadata['role'] = get_current_role()

        ts = await session_service.push_cell(code, cell_id, content, metadata)
        self.finish(json.dumps({
            "type": "push_confirmed",
            "cell_id": cell_id,
            "timestamp": ts,
            "pushed_by": machine_id
        }))


class ToggleSyncHandler(JsonAPIHandler):
    async def post(self, code: str, cell_id: str):
        machine_id = get_machine_id(self)

        data = self.get_json()
        if "sync_allowed" not in data:
            self.set_status(400)
            self.finish(json.dumps({"type": "error", "message": "sync_allowed is required"}))
            return

        sync_allowed = bool(data["sync_allowed"])
        ts = await session_service.toggle_sync(code, cell_id, sync_allowed, machine_id)
        self.finish(json.dumps({
            "type": "sync_allowed_update",
            "cell_id": cell_id,
            "sync_allowed": sync_allowed,
            "timestamp": ts,
            "toggled_by": machine_id
        }))


class NotificationsHandler(JsonAPIHandler):
    async def get(self, code: str):
        machine_id = get_machine_id(self)

        # since as float seconds; default to 0 for first poll
        since_param = self.get_query_argument("since", default="0")
        try:
            since_ts = float(since_param)
        except ValueError:
            self.set_status(400)
            self.finish(json.dumps({"type": "error", "message": "invalid since parameter"}))
            return

        items = await session_service.list_notifications(code, since_ts, machine_id)
        self.finish(json.dumps({
            "type": "notifications",
            "items": items,
            "requested_by": machine_id
        }))


class PendingCellHandler(JsonAPIHandler):
    async def get(self, code: str, cell_id: str):
        machine_id = get_machine_id(self)

        status = await session_service.get_pending_status(code, cell_id, machine_id)
        self.finish(json.dumps({
            "type": "pending_status",
            "cell_id": cell_id,
            "requested_by": machine_id,
            **status
        }))


class RequestSyncHandler(JsonAPIHandler):
    async def post(self, code: str, cell_id: str):
        machine_id = get_machine_id(self)

        result = await session_service.request_sync(code, cell_id, machine_id)
        if not result:
            self.set_status(404)
            self.finish(json.dumps({"type": "error", "message": "No pending update available or sync not allowed"}))
            return

        # Add machine info to result
        result["requested_by"] = machine_id
        self.finish(json.dumps(result))


# New hash-based read handlers
class HashKeysListHandler(JsonAPIHandler):
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
        result["requested_by"] = get_machine_id(self)
        self.finish(json.dumps({"type": "hash_keys", **result}))


class HashKeyContentHandler(JsonAPIHandler):
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

        data["requested_by"] = get_machine_id(self)
        self.finish(json.dumps({"type": "hash_key_content", "key": hash_key, **data}))


# Hash-based cell storage handlers (new specification)

class PushCellHashHandler(JsonAPIHandler):
    """
    Handler for hash-based cell pushing (new specification).
    Anyone can push cell content with cell_id and created_at timestamp.
    """
    async def post(self):
        machine_id = get_machine_id(self)

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
            "machine_id": machine_id,
            "role": get_current_role()
        }))


class RequestCellSyncHashHandler(JsonAPIHandler):
    """
    Handler for hash-based cell sync requests (new specification).
    Anyone can request cell content using cell_id and created_at timestamp.
    """
    async def post(self):
        machine_id = get_machine_id(self)

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
            "machine_id": machine_id,
            "role": get_current_role()
        }))


class NetworkInfoHandler(JsonAPIHandler):
    async def get(self):
        try:
            ip_addresses = _get_private_ipv4_addresses()
            hostname = socket.gethostname()
            if not ip_addresses:
                # Guarantee at least localhost + current hostname resolution for safety
                fallback_host = []
                try:
                    host_ip = socket.gethostbyname(hostname)
                    fallback_host.append(host_ip)
                except Exception:
                    pass
                ip_addresses = list(dict.fromkeys(fallback_host + ["127.0.0.1"]))

            # Test Redis connectivity for network validation
            redis_accessible = False
            try:
                await redis_manager.client.ping()
                redis_accessible = True
            except:
                pass

            payload = {
                "type": "network_info",
                "hostname": hostname,
                "ip_addresses": ip_addresses,
                "redis": {
                    "port": 6379,
                    "accessible": redis_accessible,
                    "docker": True,
                    "url": f"redis://{ip_addresses[0] if ip_addresses else 'localhost'}:6379"
                },
                "role": get_current_role(),
                "jupyter_port": 8888,
                "instructions": {
                    "for_students": f"Set REDIS_URL=redis://{ip_addresses[0] if ip_addresses else 'TEACHER_IP'}:6379"
                },
                "requested_by": get_machine_id(self)
            }
            self.finish(json.dumps(payload))
        except Exception as e:
            logger.error(f"Network info error: {e}")
            self.set_status(500)
            self.finish(json.dumps({
                "type": "network_info",
                "hostname": socket.gethostname(),
                "ip_addresses": [],
                "error": str(e)
            }))


class DockerRedisHandler(JsonAPIHandler):
    """Handler for Docker Redis management and testing"""

    async def get(self):
        """Get Docker Redis status and connection info"""
        try:
            info = await redis_manager.client.info()

            payload = {
                "docker_redis": {
                    "connected": True,
                    "version": info.get('redis_version'),
                    "uptime": info.get('uptime_in_seconds'),
                    "memory_usage": info.get('used_memory_human'),
                    "total_connections": info.get('total_connections_received'),
                    "url": redis_manager.redis_url
                },
                "network_ready": True,
                "requested_by": get_machine_id(self)
            }
            self.finish(json.dumps(payload))

        except Exception as e:
            payload = {
                "docker_redis": {
                    "connected": False,
                    "error": str(e),
                    "url": redis_manager.redis_url
                },
                "network_ready": False,
                "requested_by": get_machine_id(self)
            }
            self.set_status(503)
            self.finish(json.dumps(payload))

    async def post(self):
        """Test Redis connection with custom URL"""
        data = self.get_json()
        test_url = data.get('redis_url', redis_manager.redis_url)

        try:
            import redis
            test_client = redis.from_url(test_url, socket_connect_timeout=3)
            await test_client.ping()
            await test_client.close()

            self.finish(json.dumps({
                "connected": True,
                "url": test_url,
                "message": "Redis connection successful",
                "tested_by": get_machine_id(self)
            }))

        except Exception as e:
            self.finish(json.dumps({
                "connected": False,
                "url": test_url,
                "error": str(e),
                "tested_by": get_machine_id(self)
            }))


def setup_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]
    api_base = url_path_join(base_url, "notebook-sync")

    handlers = [
        # Core status and network endpoints
        (url_path_join(api_base, "status"), StatusHandler),  # GET - Enhanced Docker Redis status
        (url_path_join(api_base, "role"), RoleHandler),  # GET - Role determination from environment
        (url_path_join(api_base, "docker", "redis"), DockerRedisHandler),  # GET/POST - Docker Redis management
        (url_path_join(api_base, "network", "info"), NetworkInfoHandler),  # GET - Network discovery with Docker info

        # Session management endpoints (all open access)
        (url_path_join(api_base, "sessions"), SessionCreateHandler),  # POST
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "join"), SessionJoinHandler),  # POST
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)"), SessionEndHandler),  # DELETE
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "status"), SessionValidateHandler),  # GET

        # Cell synchronization endpoints (all open access)
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "cells", r"(?P<cell_id>[^/]+)", "push"), PushCellHandler),  # POST
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "cells", r"(?P<cell_id>[^/]+)", "toggle"), ToggleSyncHandler),  # POST
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "notifications"), NotificationsHandler),  # GET
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "cells", r"(?P<cell_id>[^/]+)", "pending"), PendingCellHandler),  # GET
        (url_path_join(api_base, "sessions", r"(?P<code>[A-Z0-9]+)", "cells", r"(?P<cell_id>[^/]+)", "request-sync"), RequestSyncHandler),  # POST

        # Hash-based synchronization endpoints (all open access)
        (url_path_join(api_base, "hash", "push-cell"), PushCellHashHandler),  # POST
        (url_path_join(api_base, "hash", "request-sync"), RequestCellSyncHashHandler),  # POST
        (url_path_join(api_base, "hash", "keys"), HashKeysListHandler),  # GET
        (url_path_join(api_base, "hash", "key", r"(?P<hash_key>[a-f0-9]{64})"), HashKeyContentHandler),  # GET
    ]
    web_app.add_handlers(host_pattern, handlers)
    logger.info("Notebook Sync REST handlers registered at %s", api_base)
