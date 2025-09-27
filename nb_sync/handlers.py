"""WebSocket handlers for JupyterLab sync extension."""

import asyncio
import json
import logging
import uuid
from typing import Optional, Literal
import tornado.websocket
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join

from .redis_client import redis_manager
from .session_manager import session_manager

logger = logging.getLogger(__name__)

class SyncWebSocketHandler(tornado.websocket.WebSocketHandler):
    """WebSocket handler for sync communication."""
    
    def __init__(self, session_code, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.connection_id = str(uuid.uuid4())
        self.role: Literal["teacher", "student"] = "student"

        # Session code will be set when the user creates or joins a session
        if self.session_code is None:
            raise ValueError("session_code must be provided")
        self.session_code: str = session_code
        self.pubsub = None
        self.pubsub_task = None
        asyncio.create_task(self.open())
    
    def check_origin(self, origin):
        """Allow WebSocket connections from any origin (for development)."""
        # In production, you should implement proper origin checking
        return True
    
    async def open(self):
        """Handle new WebSocket connection."""
        logger.info(f"WebSocket connection opened: {self.connection_id}")
        
        # Initialize Redis pubsub for this connection
        self.pubsub = await redis_manager.create_pubsub()
        
        # Send connection confirmation
        await self.send_message({
            "type": "connection_established",
            "connection_id": self.connection_id
        })
    
    async def on_message(self, message):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(message)
            msg_type = data.get('type')
            
            logger.info(f"Received message type: {msg_type} from {self.connection_id}")
            
            # Route message based on type
            if msg_type == 'create_session':
                await self.handle_create_session(data)
            elif msg_type == 'join_session':
                await self.handle_join_session(data)
            elif msg_type == 'push_cell':
                await self.handle_push_cell(data)
            elif msg_type == 'request_sync':
                await self.handle_request_sync(data)
            elif msg_type == 'toggle_sync':
                await self.handle_toggle_sync(data)
            elif msg_type == 'end_session':
                await self.handle_end_session(data)
            else:
                await self.send_error(f"Unknown message type: {msg_type}")
                
        except json.JSONDecodeError:
            await self.send_error("Invalid JSON format")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            await self.send_error(f"Server error: {str(e)}")
    
    async def handle_create_session(self, data):
        """Handle teacher creating a new session."""
        try:
            session_code = await session_manager.create_session(self)
            
            # Start listening to session notifications
            await self.start_pubsub_listener(session_code)
            
            await self.send_message({
                "type": "session_created",
                "session_code": session_code,
                "role": "teacher"
            })
            
        except Exception as e:
            await self.send_error(f"Failed to create session: {str(e)}")
    
    async def handle_join_session(self, data):
        """Handle student joining an existing session."""
        session_code = data.get('session_code')
        if not session_code:
            await self.send_error("Session code is required")
            return
        
        try:
            success = await session_manager.join_session(self, session_code)
            
            if success:
                # Start listening to session notifications
                await self.start_pubsub_listener(session_code)
                
                await self.send_message({
                    "type": "session_joined",
                    "session_code": session_code,
                    "role": "student"
                })
            else:
                await self.send_error("Failed to join session - session may not exist or be inactive")
                
        except Exception as e:
            await self.send_error(f"Failed to join session: {str(e)}")
    
    async def handle_push_cell(self, data):
        """Handle teacher pushing cell content."""
        if self.role != "teacher":
            await self.send_error("Only teachers can push cell content")
            return
        
        cell_id = data.get('cell_id')
        content = data.get('content')
        metadata = data.get('metadata', {})
        
        if not cell_id or content is None:
            await self.send_error("cell_id and content are required")
            return
        
        try:
            await session_manager.handle_teacher_push(
                self.session_code, cell_id, content, metadata
            )
            
            # Confirm to teacher
            await self.send_message({
                "type": "push_confirmed",
                "cell_id": cell_id,
                "timestamp": asyncio.get_event_loop().time()
            })
            
        except Exception as e:
            await self.send_error(f"Failed to push cell: {str(e)}")
    
    async def handle_request_sync(self, data):
        """Handle student requesting sync for a cell."""
        if self.role != "student":
            await self.send_error("Only students can request sync")
            return
        
        cell_id = data.get('cell_id')
        if not cell_id:
            await self.send_error("cell_id is invalid or missing.")
            return
        
        try:
            update_data = await session_manager.handle_student_sync_request(
                self.session_code, self, cell_id
            )
            
            if update_data:
                await self.send_message(update_data)
            else:
                await self.send_error("No pending update available or sync not allowed")
                
        except Exception as e:
            await self.send_error(f"Failed to sync cell: {str(e)}")
    
    async def handle_toggle_sync(self, data):
        """Handle teacher toggling sync permission for a cell."""
        if self.role != "teacher":
            await self.send_error("Only teachers can toggle sync permissions")
            return
        
        cell_id = data.get('cell_id')
        sync_allowed = data.get('sync_allowed')
        
        if not cell_id or sync_allowed is None:
            await self.send_error("cell_id and sync_allowed are required")
            return
        
        try:
            await session_manager.toggle_cell_sync(
                self.session_code, cell_id, sync_allowed
            )
            
            await self.send_message({
                "type": "sync_toggle_confirmed",
                "cell_id": cell_id,
                "sync_allowed": sync_allowed
            })
            
        except Exception as e:
            await self.send_error(f"Failed to toggle sync: {str(e)}")
    
    async def handle_end_session(self, data):
        """Handle teacher ending the session."""
        if self.role != "teacher":
            await self.send_error("Only teachers can end sessions")
            return
        
        try:
            await session_manager.end_session(self.session_code)
            
        except Exception as e:
            await self.send_error(f"Failed to end session: {str(e)}")
    
    async def start_pubsub_listener(self, session_code):
        """Start listening to Redis pub/sub for session notifications."""
        channel = f"sync_session_{session_code}"
        
        try:
            await self.pubsub.subscribe(channel)
            self.pubsub_task = asyncio.create_task(self.pubsub_listener())
            logger.info(f"Started pub/sub listener for channel: {channel}")
            
        except Exception as e:
            logger.error(f"Failed to start pub/sub listener: {e}")
    
    async def pubsub_listener(self):
        """Listen for Redis pub/sub messages and forward to WebSocket."""
        try:
            async for message in self.pubsub.listen():
                if message['type'] == 'message':
                    # Parse and forward the notification
                    try:
                        notification_data = json.loads(message['data'])
                        await self.send_message(notification_data)
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON in pub/sub message: {message['data']}")
                        
        except asyncio.CancelledError:
            logger.info(f"Pub/sub listener cancelled for {self.connection_id}")
        except Exception as e:
            logger.error(f"Error in pub/sub listener: {e}")
    
    async def send_message(self, data):
        """Send message to WebSocket client."""
        try:
            message = json.dumps(data)
            await self.write_message(message)
        except Exception as e:
            logger.error(f"Failed to send message to {self.connection_id}: {e}")
    
    async def send_error(self, error_message):
        """Send error message to WebSocket client."""
        await self.send_message({
            "type": "error",
            "message": error_message,
            "timestamp": asyncio.get_event_loop().time()
        })
    
    def on_close(self):
        """Handle WebSocket connection close."""
        logger.info(f"WebSocket connection closed: {self.connection_id}")
        
        # Cancel pub/sub listener
        if self.pubsub_task:
            self.pubsub_task.cancel()
        
        # Close pub/sub connection
        if self.pubsub:
            asyncio.create_task(self.cleanup_pubsub())
        
        # Remove from session manager
        session_manager.remove_connection(self)
    
    async def cleanup_pubsub(self):
        """Cleanup pub/sub resources."""
        try:
            if self.pubsub:
                await self.pubsub.close()
        except Exception as e:
            logger.error(f"Error cleaning up pub/sub: {e}")


class SyncStatusHandler(APIHandler):
    """HTTP handler for sync status and health checks."""
    
    async def get(self):
        """Get sync extension status."""
        try:
            # Test Redis connection
            await redis_manager.client.ping()
            redis_status = "connected"
        except Exception as e:
            redis_status = f"error: {str(e)}"
        
        status = {
            "extension": "jupyter-notebook-sync",
            "status": "running",
            "redis": redis_status,
            "active_sessions": len(session_manager.teacher_connections),
            "timestamp": asyncio.get_event_loop().time()
        }
        
        self.finish(json.dumps(status))


def setup_handlers(web_app):
    """Setup WebSocket and HTTP handlers for the extension."""
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]
    
    # WebSocket endpoint
    ws_pattern = url_path_join(base_url, "notebook-sync", "ws")
    
    # HTTP status endpoint
    status_pattern = url_path_join(base_url, "notebook-sync", "status")
    
    handlers = [
        (ws_pattern, SyncWebSocketHandler),
        (status_pattern, SyncStatusHandler)
    ]
    
    web_app.add_handlers(host_pattern, handlers)
    logger.info("Jupyter Notebook Sync handlers registered")