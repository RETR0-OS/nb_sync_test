"""Redis client configuration for JupyterLab sync extension."""
import asyncio
import logging
import json
from typing import Optional
import redis.asyncio as redis

logger = logging.getLogger(__name__)

class RedisManager:
    """Manages Redis connections for the sync extension."""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self._client: redis.Redis = redis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            retry_on_timeout=True,
            socket_connect_timeout=5,
            socket_keepalive=True,
            socket_keepalive_options={},
            health_check_interval=30
        )
        self._pubsub = None
        self._pubsub = None
        
    async def initialize(self) -> None:
        """Initialize Redis connection."""
        try:
            # Test connection
            await self._client.ping()
            logger.info("Redis connection established")
            
        except redis.RedisError as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
            
    async def cleanup(self) -> None:
        """Cleanup Redis connections."""
        if self._pubsub:
            await self._pubsub.close()
        if self._client:
            await self._client.close()
        logger.info("Redis connections closed")
            
    @property
    def client(self) -> redis.Redis:
        """Get Redis client instance."""
        if not self._client:
            raise RuntimeError("Redis not initialized. Call initialize() first.")
        return self._client
    
    async def create_pubsub(self):
        """Create a new pubsub instance."""
        if not self._client:
            raise RuntimeError("Redis not initialized")
        return self._client.pubsub()
    
    async def store_pending_update(self, session_code: str, cell_id: str, 
                                 content: dict, metadata: dict) -> None:
        """Store a pending cell update in Redis."""
        update_key = f"pending_update:{session_code}:{cell_id}"
        update_data = {
            "content": json.dumps(content),
            "metadata": json.dumps(metadata),
            "timestamp": str(asyncio.get_event_loop().time()),
            "status": "pending"
        }
        
        # Store the update
        await self._client.hset(update_key, mapping=update_data)
        
        # Set expiration (24 hours)
        await self._client.expire(update_key, 86400)
        
    async def get_pending_update(self, session_code: str, cell_id: str) -> Optional[dict]:
        """Retrieve a pending update from Redis."""
        update_data = await self._client.hgetall(update_key)
        
        if not update_data:
            return None
            
        return {
            "content": json.loads(update_data["content"]),
            "metadata": json.loads(update_data["metadata"]),
            "timestamp": float(update_data["timestamp"]),
            "status": update_data["status"]
        }
    
    async def mark_update_delivered(self, session_code: str, cell_id: str) -> None:
        """Mark an update as delivered."""
        await self._client.hset(update_key, mapping={"status": "delivered"})
        await self._client.hset(update_key, "status", "delivered")
    
    async def publish_notification(self, session_code: str, message: dict) -> None:
        channel = f"sync_session_{session_code}"
        await self._client.publish(channel, json.dumps(message))
        await self._client.publish(channel, redis.utils.dumps(message))
    
    async def create_session(self, session_code: str, teacher_id: str) -> None:
        session_key = f"session:{session_code}"
        session_data = {
            "teacher_id": teacher_id,
            "created_at": str(asyncio.get_event_loop().time()),
            "students": "[]",
            "status": "active"
        }
        
        await self._client.hset(session_key, mapping=session_data)
        await self._client.expire(session_key, 86400)  # 24 hours
        await self._client.expire(session_key, 86400)  # 24 hours
    
    async def add_student_to_session(self, session_code: str, student_id: str) -> bool:
        """Add a student to an existing session."""
        session_key = f"session:{session_code}"
        
        # Check if session exists
        if not await self._client.exists(session_key):
            return False
            
        students_json = await self._client.hget(session_key, "students")
        students = json.loads(students_json) if students_json else []
        
        # Add student if not already in list
        if student_id not in students:
            students.append(student_id)
            await self._client.hset(session_key, mapping={"students": json.dumps(students)})
        
        return True
    
    async def get_session_info(self, session_code: str) -> Optional[dict]:
        """Get session information."""
        session_data = await self._client.hgetall(session_key)
        
        if not session_data:
            return None
            
        return {
            "teacher_id": session_data["teacher_id"],
            "created_at": float(session_data["created_at"]),
            "students": json.loads(session_data["students"]),
            "status": session_data["status"]
        }
    
    async def end_session(self, session_code: str) -> None:
        """End a sync session and cleanup."""
        session_key = f"session:{session_code}"
        
        await self._client.hset(session_key, mapping={"status": "ended"})
        
        # Clean up pending updates for this session
        pattern = f"pending_update:{session_code}:*"
        cursor = 0
        
        while True:
            cursor, keys = await self._client.scan(cursor=cursor, match=pattern)
            if keys:
                await self._client.delete(*keys)
            if cursor == 0:
                break
                await self._client.delete(*keys)


# Global Redis manager instance
redis_manager = RedisManager()