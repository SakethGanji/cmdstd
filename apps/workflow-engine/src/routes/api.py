"""REST API routes for workflow management."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..engine.workflow_runner import WorkflowRunner
from ..engine.node_registry import node_registry, register_all_nodes
from ..engine.types import (
    Workflow,
    NodeDefinition,
    Connection,
    NodeData,
)
from ..storage.workflow_store import workflow_store
from ..storage.execution_store import execution_store

router = APIRouter(prefix="/api")

# Ensure nodes are registered
register_all_nodes()


# --- Pydantic models for API ---


class NodeDefinitionModel(BaseModel):
    """Node definition for API."""

    name: str
    type: str
    parameters: dict[str, Any] = {}
    position: dict[str, float] | None = None
    retry_on_fail: int = 0
    retry_delay: int = 1000
    continue_on_fail: bool = False


class ConnectionModel(BaseModel):
    """Connection definition for API."""

    source_node: str
    target_node: str
    source_output: str = "main"
    target_input: str = "main"


class WorkflowModel(BaseModel):
    """Workflow definition for API."""

    name: str
    nodes: list[NodeDefinitionModel]
    connections: list[ConnectionModel]
    id: str | None = None
    description: str | None = None
    settings: dict[str, Any] = {}


class WorkflowListItem(BaseModel):
    """Workflow list item response."""

    id: str
    name: str
    active: bool
    webhook_url: str
    node_count: int
    created_at: str
    updated_at: str


class WorkflowDetailResponse(BaseModel):
    """Workflow detail response."""

    id: str
    name: str
    active: bool
    webhook_url: str
    definition: dict[str, Any]
    created_at: str
    updated_at: str


class WorkflowCreateResponse(BaseModel):
    """Workflow creation response."""

    id: str
    name: str
    active: bool
    webhook_url: str
    created_at: str


class ExecutionResponse(BaseModel):
    """Workflow execution response."""

    status: str
    execution_id: str
    data: dict[str, Any]
    errors: list[dict[str, Any]]


class ExecutionListItem(BaseModel):
    """Execution list item."""

    id: str
    workflow_id: str
    workflow_name: str
    status: str
    mode: str
    start_time: str
    end_time: str | None
    error_count: int


class ActiveToggle(BaseModel):
    """Active toggle request."""

    active: bool


# --- Helper functions ---


def _workflow_model_to_internal(model: WorkflowModel) -> Workflow:
    """Convert Pydantic model to internal Workflow type."""
    return Workflow(
        name=model.name,
        id=model.id,
        description=model.description,
        nodes=[
            NodeDefinition(
                name=n.name,
                type=n.type,
                parameters=n.parameters,
                position=n.position,
                retry_on_fail=n.retry_on_fail,
                retry_delay=n.retry_delay,
                continue_on_fail=n.continue_on_fail,
            )
            for n in model.nodes
        ],
        connections=[
            Connection(
                source_node=c.source_node,
                target_node=c.target_node,
                source_output=c.source_output,
                target_input=c.target_input,
            )
            for c in model.connections
        ],
        settings=model.settings,
    )


def _workflow_to_dict(workflow: Workflow) -> dict[str, Any]:
    """Convert internal Workflow to dict for API response."""
    return {
        "name": workflow.name,
        "id": workflow.id,
        "description": workflow.description,
        "nodes": [
            {
                "name": n.name,
                "type": n.type,
                "parameters": n.parameters,
                "position": n.position,
                "retry_on_fail": n.retry_on_fail,
                "retry_delay": n.retry_delay,
                "continue_on_fail": n.continue_on_fail,
            }
            for n in workflow.nodes
        ],
        "connections": [
            {
                "source_node": c.source_node,
                "target_node": c.target_node,
                "source_output": c.source_output,
                "target_input": c.target_input,
            }
            for c in workflow.connections
        ],
        "settings": workflow.settings,
    }


# --- Workflow Routes ---


@router.get("/workflows", response_model=list[WorkflowListItem])
async def list_workflows() -> list[WorkflowListItem]:
    """List all workflows."""
    workflows = workflow_store.list()

    return [
        WorkflowListItem(
            id=w.id,
            name=w.name,
            active=w.active,
            webhook_url=f"/webhook/{w.id}",
            node_count=len(w.workflow.nodes),
            created_at=w.created_at.isoformat(),
            updated_at=w.updated_at.isoformat(),
        )
        for w in workflows
    ]


@router.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str) -> WorkflowDetailResponse:
    """Get a single workflow by ID."""
    stored = workflow_store.get(workflow_id)

    if not stored:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return WorkflowDetailResponse(
        id=stored.id,
        name=stored.name,
        active=stored.active,
        webhook_url=f"/webhook/{stored.id}",
        definition=_workflow_to_dict(stored.workflow),
        created_at=stored.created_at.isoformat(),
        updated_at=stored.updated_at.isoformat(),
    )


@router.post("/workflows", response_model=WorkflowCreateResponse)
async def create_workflow(workflow: WorkflowModel) -> WorkflowCreateResponse:
    """Create a new workflow."""
    internal_workflow = _workflow_model_to_internal(workflow)
    stored = workflow_store.create(internal_workflow)

    return WorkflowCreateResponse(
        id=stored.id,
        name=stored.name,
        active=stored.active,
        webhook_url=f"/webhook/{stored.id}",
        created_at=stored.created_at.isoformat(),
    )


@router.put("/workflows/{workflow_id}")
async def update_workflow(workflow_id: str, workflow: WorkflowModel) -> dict[str, Any]:
    """Update an existing workflow."""
    internal_workflow = _workflow_model_to_internal(workflow)
    updated = workflow_store.update(workflow_id, internal_workflow)

    if not updated:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return {
        "id": updated.id,
        "name": updated.name,
        "active": updated.active,
        "updated_at": updated.updated_at.isoformat(),
    }


@router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str) -> dict[str, bool]:
    """Delete a workflow."""
    deleted = workflow_store.delete(workflow_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return {"success": True}


@router.patch("/workflows/{workflow_id}/active")
async def toggle_workflow_active(workflow_id: str, body: ActiveToggle) -> dict[str, Any]:
    """Toggle workflow active state."""
    updated = workflow_store.set_active(workflow_id, body.active)

    if not updated:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return {
        "id": updated.id,
        "active": updated.active,
    }


@router.post("/workflows/{workflow_id}/run", response_model=ExecutionResponse)
async def run_workflow(workflow_id: str) -> ExecutionResponse:
    """Run a saved workflow."""
    stored = workflow_store.get(workflow_id)

    if not stored:
        raise HTTPException(status_code=404, detail="Workflow not found")

    runner = WorkflowRunner()
    start_node = runner.find_start_node(stored.workflow)

    if not start_node:
        raise HTTPException(status_code=400, detail="No start node found in workflow")

    initial_data = [
        NodeData(json={
            "triggeredAt": datetime.now().isoformat(),
            "mode": "manual",
        })
    ]

    context = await runner.run(stored.workflow, start_node.name, initial_data, "manual")
    execution_store.complete(context, stored.id, stored.name)

    # Convert node states to dict
    node_data = {
        name: [{"json": d.json} for d in data]
        for name, data in context.node_states.items()
    }

    return ExecutionResponse(
        status="failed" if context.errors else "success",
        execution_id=context.execution_id,
        data=node_data,
        errors=[
            {
                "node_name": e.node_name,
                "error": e.error,
                "timestamp": e.timestamp.isoformat(),
            }
            for e in context.errors
        ],
    )


@router.post("/workflows/run-adhoc", response_model=ExecutionResponse)
async def run_adhoc_workflow(workflow: WorkflowModel) -> ExecutionResponse:
    """Run an ad-hoc workflow without saving."""
    internal_workflow = _workflow_model_to_internal(workflow)

    runner = WorkflowRunner()
    start_node = runner.find_start_node(internal_workflow)

    if not start_node:
        raise HTTPException(status_code=400, detail="No start node found in workflow")

    initial_data = [
        NodeData(json={
            "triggeredAt": datetime.now().isoformat(),
            "mode": "manual",
        })
    ]

    context = await runner.run(internal_workflow, start_node.name, initial_data, "manual")
    execution_store.complete(context, internal_workflow.id or "adhoc", internal_workflow.name)

    # Convert node states to dict
    node_data = {
        name: [{"json": d.json} for d in data]
        for name, data in context.node_states.items()
    }

    return ExecutionResponse(
        status="failed" if context.errors else "success",
        execution_id=context.execution_id,
        data=node_data,
        errors=[
            {
                "node_name": e.node_name,
                "error": e.error,
                "timestamp": e.timestamp.isoformat(),
            }
            for e in context.errors
        ],
    )


# --- Execution Routes ---


@router.get("/executions", response_model=list[ExecutionListItem])
async def list_executions(workflow_id: str | None = None) -> list[ExecutionListItem]:
    """List execution history."""
    executions = execution_store.list(workflow_id)

    return [
        ExecutionListItem(
            id=e.id,
            workflow_id=e.workflow_id,
            workflow_name=e.workflow_name,
            status=e.status,
            mode=e.mode,
            start_time=e.start_time.isoformat(),
            end_time=e.end_time.isoformat() if e.end_time else None,
            error_count=len(e.errors),
        )
        for e in executions
    ]


@router.get("/executions/{execution_id}")
async def get_execution(execution_id: str) -> dict[str, Any]:
    """Get execution details."""
    execution = execution_store.get(execution_id)

    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    return {
        "id": execution.id,
        "workflow_id": execution.workflow_id,
        "workflow_name": execution.workflow_name,
        "status": execution.status,
        "mode": execution.mode,
        "start_time": execution.start_time.isoformat(),
        "end_time": execution.end_time.isoformat() if execution.end_time else None,
        "errors": [
            {
                "node_name": e.node_name,
                "error": e.error,
                "timestamp": e.timestamp.isoformat(),
            }
            for e in execution.errors
        ],
        "node_data": {
            name: [{"json": d.json} for d in data]
            for name, data in execution.node_data.items()
        },
    }


@router.delete("/executions/{execution_id}")
async def delete_execution(execution_id: str) -> dict[str, bool]:
    """Delete an execution record."""
    deleted = execution_store.delete(execution_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Execution not found")

    return {"success": True}


@router.delete("/executions")
async def clear_executions() -> dict[str, bool]:
    """Clear all execution records."""
    execution_store.clear()
    return {"success": True}


# --- Node Routes ---


@router.get("/nodes")
async def list_nodes() -> list[dict[str, Any]]:
    """List all available node types with schemas."""
    nodes = node_registry.get_node_info_full()

    return [
        {
            "type": n.type,
            "displayName": n.display_name,
            "description": n.description,
            "icon": n.icon,
            "group": n.group,
            "inputCount": n.input_count,
            "outputCount": n.output_count,
            "properties": n.properties,
            "inputs": n.inputs,
            "outputs": n.outputs,
            "inputStrategy": n.input_strategy,
            "outputStrategy": n.output_strategy,
        }
        for n in nodes
    ]


@router.get("/nodes/{node_type}")
async def get_node_schema(node_type: str) -> dict[str, Any]:
    """Get schema for a specific node type."""
    info = node_registry.get_node_type_info(node_type)

    if not info:
        raise HTTPException(status_code=404, detail=f'Node type "{node_type}" not found')

    return {
        "type": info.type,
        "displayName": info.display_name,
        "description": info.description,
        "icon": info.icon,
        "group": info.group,
        "inputCount": info.input_count,
        "outputCount": info.output_count,
        "properties": info.properties,
        "inputs": info.inputs,
        "outputs": info.outputs,
        "inputStrategy": info.input_strategy,
        "outputStrategy": info.output_strategy,
    }
