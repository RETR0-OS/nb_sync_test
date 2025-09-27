"""Session management for JupyterLab sync extension."""

import asyncio
import json
import logging
import secrets
import string
from typing import Dict, Set, Optional
from .redis_client import redis_manager

logger = logging.getLogger(__name__)

class SessionManager:
    """Manages sync sessions and WebSocket connections."""
    
    def __init__(self):
        # In-memory tracking of active WebSocket connections
        self.teacher_connections: Dict[str, 'SyncWebSocketHandler'] = {}
        self.student_connections: Dict[str, Set['SyncWebSocketHandler']] = {}
        
    def generate_session_code(self, length: int = 6) -> str:
        """Generate a random session code."""
        alphabet = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))
    
    async def create_session(self, teacher_ws: 'SyncWebSocketHandler') -> str:
        """Create a new sync session with teacher as host."""
        session_code = self.generate_session_code()
        
        # Ensure unique session code
        while await redis_manager.get_session_info(session_code):
            session_code = self.generate_session_code()
        
        # Store in Redis
        await redis_manager.create_session(session_code, teacher_ws.connection_id)
        
        # Track teacher connection
        self.teacher_connections[session_code] = teacher_ws
        teacher_ws.session_code = session_code
        teacher_ws.role = "teacher"
        
        logger.info(f"Session {session_code} created by teacher {teacher_ws.connection_id}")
        return session_code
    
    async def join_session(self, student_ws: 'SyncWebSocketHandler', session_code: str) -> bool:
        """Add student to existing session."""
        # Validate session exists
        session_info = await redis_manager.get_session_info(session_code)
        if not session_info or session_info["status"] != "active":
            return False
        
        # Add student to Redis
        success = await redis_manager.add_student_to_session(session_code, student_ws.connection_id)
        if not success:
            return False
        
        # Track student connection
        if session_code not in self.student_connections:
            self.student_connections[session_code] = set()
        
        self.student_connections[session_code].add(student_ws)
        student_ws.session_code = session_code
        student_ws.role = "student"
        
        # Notify teacher about new student
        await self.notify_teacher_student_joined(session_code, student_ws.connection_id)
        
        logger.info(f"Student {student_ws.connection_id} joined session {session_code}")
        return True
    
    async def notify_teacher_student_joined(self, session_code: str, student_id: str):
        """Notify teacher that a student joined the session."""
        if session_code in self.teacher_connections:
            teacher_ws = self.teacher_connections[session_code]
            await teacher_ws.send_message({
                "type": "student_joined",
                "student_id": student_id,
                "timestamp": asyncio.get_event_loop().time()
            })
    
    async def handle_teacher_push(self, session_code: str, cell_id: str, 
                                content: dict, metadata: dict) -> bool:
        """Handle teacher pushing cell content."""
        # Store the pending update
        await redis_manager.store_pending_update(session_code, cell_id, content, metadata)
        
        # Create notification for students (not the actual content)
        notification = {
            "type": "update_available",
            "cell_id": cell_id,
            "timestamp": asyncio.get_event_loop().time(),
            "sync_allowed": metadata.get("sync_allowed", True)
        }
        
        # Publish notification to Redis channel
        await redis_manager.publish_notification(session_code, notification)
        
        logger.info(f"Teacher pushed update for cell {cell_id} in session {session_code}")
        return True
    
    async def handle_student_sync_request(self, session_code: str, student_ws: 'SyncWebSocketHandler', 
                                        cell_id: str) -> Optional[dict]:
        """Handle student requesting sync for a specific cell."""
        # Get pending update from Redis
        update_data = await redis_manager.get_pending_update(session_code, cell_id)
        
        if not update_data:
            return None
        
        # Check if sync is allowed
        metadata = update_data["metadata"]
        if not metadata.get("sync_allowed", True):
            return None
        
        # Mark as delivered
        await redis_manager.mark_update_delivered(session_code, cell_id)
        
        # Return the actual content
        response_data = {
            "type": "cell_content_update",
            "cell_id": cell_id,
            "content": update_data["content"],
            "metadata": metadata,
            "timestamp": update_data["timestamp"]
        }
        
        logger.info(f"Student {student_ws.connection_id} synced cell {cell_id} in session {session_code}")
        return response_data
    
    async def toggle_cell_sync(self, session_code: str, cell_id: str, sync_allowed: bool):
        """Toggle sync permission for a specific cell."""
        # Update any existing pending update
        update_data = await redis_manager.get_pending_update(session_code, cell_id)
        if update_data:
            update_data["metadata"]["sync_allowed"] = sync_allowed
            await redis_manager.store_pending_update(
                session_code, 
                cell_id, 
                update_data["content"], 
                update_data["metadata"]
            )
        
        # Notify students about sync permission change
        notification = {
            "type": "sync_allowed_update",
            "cell_id": cell_id,
            "sync_allowed": sync_allowed,
            "timestamp": asyncio.get_event_loop().time()
        }
        
        await redis_manager.publish_notification(session_code, notification)
        
        logger.info(f"Sync permission for cell {cell_id} set to {sync_allowed} in session {session_code}")
    
    async def end_session(self, session_code: str):
        """End a sync session and cleanup."""
        # End session in Redis
        await redis_manager.end_session(session_code)
        
        # Notify all participants
        end_message = {
            "type": "session_ended",
            "session_code": session_code,
            "timestamp": asyncio.get_event_loop().time()
        }
        
        # Notify teacher
        if session_code in self.teacher_connections:
            teacher_ws = self.teacher_connections[session_code]
            await teacher_ws.send_message(end_message)
            del self.teacher_connections[session_code]
        
        # Notify students
        if session_code in self.student_connections:
            for student_ws in self.student_connections[session_code]:
                await student_ws.send_message(end_message)
            del self.student_connections[session_code]
        
        logger.info(f"Session {session_code} ended")
    
    def remove_connection(self, ws: 'SyncWebSocketHandler'):
        """Remove a WebSocket connection from tracking."""
        if hasattr(ws, 'session_code') and ws.session_code:
            session_code = ws.session_code
            
            if ws.role == "teacher" and session_code in self.teacher_connections:
                del self.teacher_connections[session_code]
                # End session when teacher disconnects
                asyncio.create_task(self.end_session(session_code))
                
            elif ws.role == "student" and session_code in self.student_connections:
                self.student_connections[session_code].discard(ws)
                if not self.student_connections[session_code]:
                    del self.student_connections[session_code]
        
        logger.info(f"Connection {ws.connection_id} removed")


# Global session manager instance
session_manager = SessionManager()