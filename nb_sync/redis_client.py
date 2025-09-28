# jupyter_notebook_sync/redis_client.py
import hashlib
import json
import logging
import os
import time
from typing import Optional, List, Dict, Any, Tuple

import redis.asyncio as redis

logger = logging.getLogger(__name__)


def _now() -> float:
    return time.time()


def _cell_hash(cell_id: str, created_at: str) -> str:
    """
    Generate a deterministic hash key for a cell based on its ID and creation timestamp.
    
    Args:
        cell_id: The cell identifier
        created_at: The creation timestamp as string
        
    Returns:
        SHA256 hash as hex string for use as Redis key
    """
    # Combine cell_id and created_at with a separator to avoid collisions
    combined = f"{cell_id}:{created_at}"
    return hashlib.sha256(combined.encode('utf-8')).hexdigest()


class RedisManager:
    """
    Redis-based storage manager for Jupyter notebook synchronization.
    
    This class provides both session-based collaboration (legacy) and 
    hash-based cell storage (new specification) for teacher-student workflows.
    
    Configuration for networked Redis (teacher-student on same network):
    - Teacher runs Redis server (e.g., redis-server --bind 0.0.0.0)  
    - Students set REDIS_URL=redis://<TEACHER_IP>:6379 (e.g., redis://192.168.1.42:6379)
    - Both teacher and students use the same RedisManager instance
    
    New hash-based cell storage:
    - Teacher calls store_cell_by_hash(cell_id, created_at, content)
    - Student calls get_cell_by_hash(cell_id, created_at) to retrieve same content
    - Uses SHA256 hash of cell_id:created_at as Redis key for uniqueness
    """
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
    #
    # Hash-based cell keys (new specification):
    # cell_hash:{hash} -> json string { content, created_at }
    # where hash = SHA256(cell_id:created_at)

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

    # Hash-based cell storage methods (new specification)
    
    async def store_cell_by_hash(
        self,
        cell_id: str,
        created_at: str,
        content: str,
        ttl_seconds: int = 86400,
    ) -> str:
        """
        Store cell content using hash-based key generation.
        
        This method implements the new specification for teacher cell pushing:
        - Generates a hash key from cell_id + created_at
        - Stores cell data as { "content": content, "created_at": created_at }
        
        Args:
            cell_id: The cell identifier
            created_at: Creation timestamp as string
            content: The cell content to store
            ttl_seconds: Time-to-live for the stored data (default 24 hours)
            
        Returns:
            The hash key used for storage
        """
        hash_key = _cell_hash(cell_id, created_at)
        cell_data = {
            "content": content,
            "created_at": created_at,
        }
        
        # Store as JSON string value under the hash key
        await self.client.set(
            f"cell_hash:{hash_key}",
            json.dumps(cell_data),
            ex=ttl_seconds
        )
        
        logger.info("Stored cell %s (created_at=%s) under hash key %s", cell_id, created_at, hash_key[:8])
        return hash_key

    async def get_cell_by_hash(
        self,
        hash_key: str,
        redis_url_override: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve cell content using hash-based key generation.
        
        This method implements the new specification for student sync requests:
        - Returns stored cell data or None if not found
        
        Args:
            hash_key: The hex SHA-256 hash key (without prefix)
            redis_url_override: Optional Redis URL to use for this request (e.g., teacher IP)
            
        Returns:
            Dict with "content" and "created_at" keys, or None if not found
        """
        try:
            # Optionally use a separate client if override is provided (e.g., student points to teacher IP)
            if redis_url_override and (not self._client or redis_url_override != self.redis_url):
                temp_client = redis.from_url(
                    redis_url_override,
                    encoding="utf-8",
                    decode_responses=True,
                    retry_on_timeout=True,
                    health_check_interval=30,
                )
                try:
                    stored_data = await temp_client.get(f"cell_hash:{hash_key}")
                finally:
                    await temp_client.close()
            else:
                stored_data = await self.client.get(f"cell_hash:{hash_key}")

            if not stored_data:
                logger.debug("No cell found for hash key %s", hash_key[:8])
                return None

            cell_data = json.loads(stored_data)
            logger.info("Retrieved cell data for hash key %s", hash_key[:8])
            return cell_data

        except (json.JSONDecodeError, Exception) as e:
            logger.error("Error retrieving cell data for hash key %s: %s", hash_key[:8], e)
            return None

    async def get_cell_by_identity(
        self,
        cell_id: str,
        created_at: str,
        redis_url_override: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Helper to retrieve by (cell_id, created_at) by computing the hash internally."""
        return await self.get_cell_by_hash(_cell_hash(cell_id, created_at), redis_url_override)

    async def list_cell_hash_keys(
        self,
        cursor: int = 0,
        match: Optional[str] = None,
        count: int = 500,
        redis_url_override: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        List available published cell keys using SCAN. Returns keys with the full Redis key names.

        Args:
            cursor: SCAN cursor to support pagination (0 to start)
            match: Optional match pattern; defaults to 'cell_hash:*'
            count: Hint for page size
            redis_url_override: Optional Redis URL override (teacher IP)

        Returns:
            { 'items': List[str], 'next_cursor': int }
        """
        pattern = match or "cell_hash:*"
        try:
            if redis_url_override and (not self._client or redis_url_override != self.redis_url):
                temp_client = redis.from_url(
                    redis_url_override,
                    encoding="utf-8",
                    decode_responses=True,
                    retry_on_timeout=True,
                    health_check_interval=30,
                )
                try:
                    next_cursor, keys = await temp_client.scan(cursor=cursor, match=pattern, count=count)
                finally:
                    await temp_client.close()
            else:
                next_cursor, keys = await self.client.scan(cursor=cursor, match=pattern, count=count)

            return {"items": keys, "next_cursor": int(next_cursor)}
        except Exception as e:
            logger.error("Error listing cell hash keys: %s", e)
            return {"items": [], "next_cursor": 0}

redis_manager = RedisManager()