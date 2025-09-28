# jupyter_notebook_sync/redis_client.py
import json
import logging
import os
import time
from typing import Optional, List, Dict, Any, Tuple

import redis.asyncio as redis

logger = logging.getLogger(__name__)


def _now() -> float:
    return time.time()


class RedisManager:
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379")
        self._client: Optional[redis.Redis] = None

    async def initialize(self) -> None:
        self._client = redis.from_url(
            self.redis_url,
            encoding="utf-8",
            decode_responses=True,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        await self._client.ping()
        logger.info("Redis connection established at %s", self.redis_url)

    async def cleanup(self) -> None:
        if self._client:
            await self._client.close()
            logger.info("Redis connection closed")

    @property
    def client(self) -> redis.Redis:
        if not self._client:
            raise RuntimeError("Redis not initialized")
        return self._client

    # Session keys
    # session:{code} -> hash { teacher_id, created_at, status, students(json) }
    # session_updates:{code} -> zset (member=cell_id score=timestamp)
    # pending_update:{code}:{cell_id} -> hash { content(json), metadata(json), timestamp, status }

    async def create_session(self, code: str, teacher_id: str = None) -> None:
        key = f"session:{code}"
        data = {
            "teacher_id": teacher_id or "unknown",
            "created_at": str(_now()),
            "status": "active",
            "students": json.dumps([]),
        }
        await self.client.hset(key, mapping=data)

    async def get_session(self, code: str) -> Optional[Dict[str, Any]]:
        key = f"session:{code}"
        h = await self.client.hgetall(key)
        if not h:
            return None
        return {
            "teacher_id": h.get("teacher_id"),
            "created_at": float(h.get("created_at", "0")),
            "status": h.get("status", "ended"),
            "students": json.loads(h.get("students", "[]")),
        }

    async def add_student(self, code: str, student_id: str) -> bool:
        sess = await self.get_session(code)
        if not sess or sess["status"] != "active":
            return False
        students = set(sess["students"])
        students.add(student_id)
        await self.client.hset(f"session:{code}", mapping={"students": json.dumps(list(students))})
        return True

    async def end_session(self, code: str) -> None:
        await self.client.hset(f"session:{code}", mapping={"status": "ended"})
        # Optionally clean pending updates
        cursor = 0
        pattern = f"pending_update:{code}:*"
        while True:
            cursor, keys = await self.client.scan(cursor=cursor, match=pattern, count=500)
            if keys:
                await self.client.delete(*keys)
            if cursor == 0:
                break
        await self.client.delete(f"session_updates:{code}")

    async def store_pending_update(
        self,
        code: str,
        cell_id: str,
        content: Dict[str, Any],
        metadata: Dict[str, Any],
        ttl_seconds: int = 86400,
    ) -> float:
        ts = _now()
        key = f"pending_update:{code}:{cell_id}"
        await self.client.hset(
            key,
            mapping={
                "content": json.dumps(content),
                "metadata": json.dumps(metadata),
                "timestamp": str(ts),
                "status": "pending",
            },
        )
        await self.client.expire(key, ttl_seconds)
        # Track latest timestamp per cell in session_notifications zset
        await self.client.zadd(f"session_updates:{code}", {cell_id: ts})
        return ts

    async def get_pending_update(self, code: str, cell_id: str) -> Optional[Dict[str, Any]]:
        key = f"pending_update:{code}:{cell_id}"
        h = await self.client.hgetall(key)
        if not h:
            return None
        return {
            "content": json.loads(h["content"]),
            "metadata": json.loads(h["metadata"]),
            "timestamp": float(h["timestamp"]),
            "status": h.get("status", "pending"),
        }

    async def update_sync_allowed(self, code: str, cell_id: str, sync_allowed: bool) -> float:
        upd = await self.get_pending_update(code, cell_id)
        ts = _now()
        if upd:
            md = upd["metadata"]
            md["sync_allowed"] = bool(sync_allowed)
            key = f"pending_update:{code}:{cell_id}"
            await self.client.hset(
                key,
                mapping={
                    "metadata": json.dumps(md),
                    "timestamp": str(ts),
                },
            )
            await self.client.zadd(f"session_updates:{code}", {cell_id: ts})
            return ts
        # If no pending update exists, still record the permission change as notification
        await self.client.zadd(f"session_updates:{code}", {cell_id: ts})
        return ts

    async def list_notifications(self, code: str, since_ts: float) -> List[Dict[str, Any]]:
        # Find cells updated after since_ts
        zkey = f"session_updates:{code}"
        items: List[Tuple[str, float]] = await self.client.zrangebyscore(
            zkey, min=since_ts, max="+inf", withscores=True
        )
        notifications: List[Dict[str, Any]] = []
        for cell_id, score in items:
            upd = await self.get_pending_update(code, cell_id)
            if upd:
                notifications.append(
                    {
                        "cell_id": cell_id,
                        "timestamp": upd["timestamp"],
                        "sync_allowed": bool(upd["metadata"].get("sync_allowed", True)),
                        "available": True,
                    }
                )
        # Remove duplicates if any and sort by timestamp
        notifications.sort(key=lambda x: x["timestamp"])
        return notifications

redis_manager = RedisManager()