"""JupyterLab Notebook Sync Extension."""

import asyncio
import logging
from jupyter_server.extension.application import ExtensionApp

from .handlers import setup_handlers
from .redis_client import redis_manager
from .simple_auth import get_user_role

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

__version__ = "0.1.0"


def _jupyter_labextension_paths():
    """Return metadata for JupyterLab extension."""
    return [{
        "src": "labextension",
        "dest": "@jupyter/nb-sync"
    }]


def _jupyter_server_extension_points():
    """Return server extension points for Jupyter Server."""
    return [{
        "module": "nb_sync"
    }]


async def _initialize_redis():
    """Initialize Redis connection only."""
    try:
        await redis_manager.initialize()
        logger.info("Redis connection initialized successfully")
        logger.info(f"Running in {get_user_role()} mode")
    except Exception as e:
        logger.error(f"Failed to initialize Redis: {e}")
        raise


def _load_jupyter_server_extension(server_app):
    """Load the Jupyter server extension.

    Parameters
    ----------
    server_app : jupyter_server.serverapp.ServerApp
        The Jupyter server application instance.
    """
    # Initialize Redis only
    loop = asyncio.get_event_loop()
    loop.run_until_complete(_initialize_redis())

    # Setup handlers
    web_app = server_app.web_app
    setup_handlers(web_app)

    # Register cleanup on server stop
    def cleanup():
        """Cleanup function for server shutdown."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(redis_manager.cleanup())
        loop.close()

    name = "nb_sync"
    server_app.log.info(f"Registered {name} server extension")
    server_app.log.info(f"Extension running in {get_user_role()} mode")