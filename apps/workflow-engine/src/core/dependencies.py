"""FastAPI dependency injection for workflow engine."""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from fastapi import Depends


# --- Store Dependencies ---


@lru_cache
def get_workflow_store():
    """Get workflow store instance."""
    from ..storage.workflow_store import workflow_store

    return workflow_store


@lru_cache
def get_execution_store():
    """Get execution store instance."""
    from ..storage.execution_store import execution_store

    return execution_store


@lru_cache
def get_node_registry():
    """Get node registry instance."""
    from ..engine.node_registry import node_registry

    return node_registry


# --- Service Dependencies ---


def get_workflow_service(
    workflow_store=Depends(get_workflow_store),
    execution_store=Depends(get_execution_store),
):
    """Get workflow service instance."""
    from ..services.workflow_service import WorkflowService

    return WorkflowService(workflow_store, execution_store)


def get_execution_service(
    execution_store=Depends(get_execution_store),
    workflow_store=Depends(get_workflow_store),
):
    """Get execution service instance."""
    from ..services.execution_service import ExecutionService

    return ExecutionService(execution_store, workflow_store)


def get_node_service(
    node_registry=Depends(get_node_registry),
):
    """Get node service instance."""
    from ..services.node_service import NodeService

    return NodeService(node_registry)
