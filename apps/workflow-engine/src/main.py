"""Main entry point for the workflow engine server."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.api import router as api_router
from .routes.webhooks import router as webhook_router
from .routes.execution_stream import router as stream_router
from .engine.node_registry import register_all_nodes


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler."""
    # Startup
    register_all_nodes()
    print("Workflow Engine started")
    print("Available endpoints:")
    print("  - GET  /api/workflows       - List workflows")
    print("  - POST /api/workflows       - Create workflow")
    print("  - GET  /api/workflows/:id   - Get workflow")
    print("  - POST /api/workflows/:id/run - Run workflow")
    print("  - POST /webhook/:id         - Webhook trigger")
    print("  - GET  /api/nodes           - List node types")
    print("  - GET  /execution-stream/:id - SSE stream")

    yield

    # Shutdown
    print("Workflow Engine stopped")


app = FastAPI(
    title="Workflow Engine",
    description="Python workflow engine with Prefect 3.0 - DAG-based workflow execution",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router)
app.include_router(webhook_router)
app.include_router(stream_router)


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {
        "name": "Workflow Engine",
        "version": "0.1.0",
        "status": "running",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


def main() -> None:
    """Run the server."""
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=3001,
        reload=True,
    )


if __name__ == "__main__":
    main()
