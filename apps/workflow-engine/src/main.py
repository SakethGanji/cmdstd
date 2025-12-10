"""Main entry point for the workflow engine server."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .engine.node_registry import register_all_nodes
from .routes import api_router, webhook_router, stream_router
from .schemas.common import RootResponse, HealthResponse
from .db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler."""
    # Initialize database tables
    await init_db()
    print("Database initialized")

    register_all_nodes()
    print(f"{settings.app_name} v{settings.app_version} started")
    print(f"Running on http://{settings.host}:{settings.port}")
    print("API documentation available at /docs")

    yield

    print(f"{settings.app_name} stopped")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.app_name,
        description="Python workflow engine - DAG-based workflow execution",
        version=settings.app_version,
        lifespan=lifespan,
        debug=settings.debug,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=settings.cors_allow_methods,
        allow_headers=settings.cors_allow_headers,
    )

    # Include routers
    app.include_router(api_router)
    app.include_router(webhook_router, tags=["Webhooks"])
    app.include_router(stream_router, tags=["Streaming"])

    # Root endpoints
    @app.get("/", response_model=RootResponse)
    async def root() -> RootResponse:
        """Root endpoint."""
        return RootResponse(
            name=settings.app_name,
            version=settings.app_version,
            status="running",
        )

    @app.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        """Health check endpoint."""
        return HealthResponse(
            status="healthy",
            version=settings.app_version,
        )

    return app


# Create app instance
app = create_app()


def main() -> None:
    """Run the server."""
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
    )


if __name__ == "__main__":
    main()
