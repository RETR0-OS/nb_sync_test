# JupyterLab Notebook Sync Extension

A JupyterLab extension that enables real-time collaboration between teachers and students with request-based synchronization.

## Features

- **Teacher-Student Sessions**: Teachers create sessions, students join with session codes
- **Request-Based Sync**: Students receive notifications but only sync when they choose to
- **Cell-Level Control**: Teachers can toggle sync permissions per cell
- **Redis Pub-Sub**: Scalable architecture using Redis for real-time messaging
- **Persistent Updates**: Updates stored in Redis until students request them

## Architecture

- **Backend**: Tornado WebSocket handlers with Redis pub-sub
- **Session Management**: In-memory connection tracking with Redis persistence
- **Notifications**: Students get notified of available updates, not automatic syncs
- **Security**: Role-based permissions and input validation

## Installation

### 1. Start Redis

Start Redis using Docker:

```bash
# From the project root directory
docker-compose up -d
```

Or install Redis manually:
```bash
# On macOS
brew install redis
brew services start redis

# On Ubuntu
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
```

### 2. Install the Extension

```bash
# Clone the repository
git clone https://github.com/your-username/jupyter-notebook-sync.git
cd jupyter-notebook-sync

# Install in development mode
pip install -e .

# Enable the server extension
jupyter server extension enable jupyter_notebook_sync

# Verify installation
jupyter server extension list
```

### 3. Start JupyterLab

```bash
jupyter lab --autoreload
```

## Usage

### Teacher Workflow

1. **Create Session**:
   ```javascript
   // Frontend JavaScript (connect to WebSocket)
   const ws = new WebSocket('ws://localhost:8888/notebook-sync/ws');
   
   // Create session
   ws.send(JSON.stringify({
       type: 'create_session'
   }));
   ```

2. **Push Cell Updates**:
   ```javascript
   ws.send(JSON.stringify({
       type: 'push_cell',
       cell_id: 'cell_001',
       content: { source: 'print("Hello, students!")' },
       metadata: { sync_allowed: true }
   }));
   ```

3. **Toggle Sync Permissions**:
   ```javascript
   ws.send(JSON.stringify({
       type: 'toggle_sync',
       cell_id: 'cell_001',
       sync_allowed: false
   }));
   ```

### Student Workflow

1. **Join Session**:
   ```javascript
   ws.send(JSON.stringify({
       type: 'join_session',
       session_code: 'ABC123'
   }));
   ```

2. **Listen for Notifications**:
   ```javascript
   ws.onmessage = (event) => {
       const data = JSON.parse(event.data);
       
       if (data.type === 'update_available') {
           // Show UI indicator that update is available
           showUpdateNotification(data.cell_id, data.timestamp);
       }
   };
   ```

3. **Request Sync** (when student chooses):
   ```javascript
   ws.send(JSON.stringify({
       type: 'request_sync',
       cell_id: 'cell_001'
   }));
   ```

## Message Protocol

### Teacher Messages

- `create_session`: Create new session
- `push_cell`: Push cell content (stores in Redis, notifies students)
- `toggle_sync`: Enable/disable sync for specific cells
- `end_session`: End the session

### Student Messages

- `join_session`: Join existing session with code
- `request_sync`: Request specific cell content

### Server Responses

- `session_created`: Session creation confirmation
- `session_joined`: Session join confirmation
- `update_available`: Notification of available update (NOT content)
- `cell_content_update`: Actual cell content (only after request)
- `sync_allowed_update`: Sync permission changes
- `error`: Error messages

## Configuration

### Redis Configuration

Set Redis URL in environment variables:

```bash
export REDIS_URL="redis://localhost:6379"
```

### Extension Settings

The extension can be configured via Jupyter configuration:

```python
# jupyter_lab_config.py
c.NotebookSyncExtensionApp.redis_url = "redis://localhost:6379"
```

## Development

### Setup Development Environment

```bash
# Install in development mode
pip install -e .

# Install development dependencies
pip install -e ".[test]"

# Run tests
pytest
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=jupyter_notebook_sync

# Run specific test
pytest tests/test_handlers.py::test_websocket_connection
```

### Code Structure

```
jupyter_notebook_sync/
├── __init__.py          # Extension entry point
├── handlers.py          # WebSocket and HTTP handlers
├── session_manager.py   # Session and connection management
└── redis_client.py      # Redis client and operations
```

## Security Considerations

- **Origin Checking**: Implement proper origin validation for production
- **Authentication**: Integrate with JupyterLab's authentication system
- **Input Validation**: All message content is validated and sanitized
- **Rate Limiting**: Consider adding rate limiting for WebSocket messages
- **Redis Security**: Use Redis AUTH and TLS in production

## Troubleshooting

### Redis Connection Issues

```bash
# Check Redis status
redis-cli ping

# Check Redis logs
docker logs jupyter-sync-redis
```

### Extension Not Loading

```bash
# Check if extension is enabled
jupyter server extension list

# Check JupyterLab logs
jupyter lab --debug
```

### WebSocket Connection Failed

1. Check if extension is properly registered
2. Verify Redis is running
3. Check browser console for errors
4. Verify WebSocket URL in client code

## API Reference

### HTTP Endpoints

- `GET /notebook-sync/status`: Extension status and health check

### WebSocket Endpoint

- `ws://localhost:8888/notebook-sync/ws`: Main WebSocket connection

### Redis Keys

- `session:{session_code}`: Session metadata
- `pending_update:{session_code}:{cell_id}`: Stored cell updates
- Channel: `sync_session_{session_code}`: Pub-sub notifications

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

BSD 3-Clause License