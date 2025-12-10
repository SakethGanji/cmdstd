"""Server-Sent Events (SSE) routes for real-time execution streaming."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import Annotated, Any, AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from ..core.exceptions import WorkflowNotFoundError, WorkflowExecutionError
from ..core.dependencies import get_workflow_repository, get_execution_repository
from ..engine.workflow_runner import WorkflowRunner
from ..engine.types import (
    ExecutionEvent,
    NodeData,
    NodeDefinition,
    Connection,
    Workflow,
)
from ..repositories import WorkflowRepository, ExecutionRepository

router = APIRouter()


class AdhocWorkflowRequest(BaseModel):
    """Request schema for ad-hoc SSE execution."""

    name: str
    nodes: list[dict[str, Any]]
    connections: list[dict[str, Any]]
    id: str | None = None
    description: str | None = None
    settings: dict[str, Any] = {}


def _event_to_dict(event: ExecutionEvent) -> dict[str, Any]:
    """Convert ExecutionEvent to dict for SSE."""
    result: dict[str, Any] = {
        "type": event.type.value,
        "executionId": event.execution_id,
        "timestamp": event.timestamp.isoformat(),
    }

    if event.node_name:
        result["nodeName"] = event.node_name
    if event.node_type:
        result["nodeType"] = event.node_type
    if event.data:
        result["data"] = [{"json": d.json} for d in event.data]
    if event.error:
        result["error"] = event.error
    if event.progress:
        result["progress"] = event.progress

    return result


async def _run_workflow_with_events(
    workflow: Workflow,
    start_node_name: str,
    initial_data: list[NodeData],
    mode: str,
    execution_repo: ExecutionRepository,
) -> AsyncGenerator[str, None]:
    """Run workflow and yield SSE events."""
    event_queue: asyncio.Queue[ExecutionEvent | None] = asyncio.Queue()

    def on_event(event: ExecutionEvent) -> None:
        event_queue.put_nowait(event)

    runner = WorkflowRunner()

    async def run_workflow() -> None:
        try:
            context = await runner.run(
                workflow,
                start_node_name,
                initial_data,
                mode,
                on_event,
            )
            await execution_repo.complete(context, workflow.id or "adhoc", workflow.name)
        except Exception as e:
            on_event(
                ExecutionEvent(
                    type=ExecutionEvent.__class__,  # type: ignore
                    execution_id="error",
                    timestamp=datetime.now(),
                    error=str(e),
                )
            )
        finally:
            event_queue.put_nowait(None)

    task = asyncio.create_task(run_workflow())

    try:
        while True:
            event = await event_queue.get()
            if event is None:
                break
            yield json.dumps(_event_to_dict(event))
    finally:
        if not task.done():
            task.cancel()


@router.get("/execution-stream/{workflow_id}")
async def stream_workflow_execution(
    workflow_id: str,
    workflow_repo: Annotated[WorkflowRepository, Depends(get_workflow_repository)],
    execution_repo: Annotated[ExecutionRepository, Depends(get_execution_repository)],
) -> EventSourceResponse:
    """Stream workflow execution via SSE for a saved workflow."""
    stored = await workflow_repo.get(workflow_id)
    if not stored:
        raise HTTPException(status_code=404, detail=f"Workflow not found: {workflow_id}")

    runner = WorkflowRunner()
    start_node = runner.find_start_node(stored.workflow)

    if not start_node:
        raise HTTPException(status_code=400, detail="No start node found in workflow")

    initial_data = [
        NodeData(
            json={
                "triggeredAt": datetime.now().isoformat(),
                "mode": "manual",
            }
        )
    ]

    async def event_generator() -> AsyncGenerator[str, None]:
        async for event in _run_workflow_with_events(
            stored.workflow,
            start_node.name,
            initial_data,
            "manual",
            execution_repo,
        ):
            yield event

    return EventSourceResponse(event_generator())


@router.post("/execution-stream/adhoc")
async def stream_adhoc_execution(
    workflow: AdhocWorkflowRequest,
    execution_repo: Annotated[ExecutionRepository, Depends(get_execution_repository)],
) -> EventSourceResponse:
    """Stream ad-hoc workflow execution via SSE."""
    internal_workflow = Workflow(
        name=workflow.name,
        id=workflow.id,
        description=workflow.description,
        nodes=[
            NodeDefinition(
                name=n["name"],
                type=n["type"],
                parameters=n.get("parameters", {}),
                position=n.get("position"),
                retry_on_fail=n.get("retry_on_fail") or n.get("retryOnFail", 0),
                retry_delay=n.get("retry_delay") or n.get("retryDelay", 1000),
                continue_on_fail=n.get("continue_on_fail") or n.get("continueOnFail", False),
            )
            for n in workflow.nodes
        ],
        connections=[
            Connection(
                source_node=c.get("source_node") or c.get("sourceNode"),
                target_node=c.get("target_node") or c.get("targetNode"),
                source_output=c.get("source_output") or c.get("sourceOutput", "main"),
                target_input=c.get("target_input") or c.get("targetInput", "main"),
            )
            for c in workflow.connections
        ],
        settings=workflow.settings,
    )

    runner = WorkflowRunner()
    start_node = runner.find_start_node(internal_workflow)

    if not start_node:
        raise HTTPException(status_code=400, detail="No start node found in workflow")

    initial_data = [
        NodeData(
            json={
                "triggeredAt": datetime.now().isoformat(),
                "mode": "manual",
            }
        )
    ]

    async def event_generator() -> AsyncGenerator[str, None]:
        async for event in _run_workflow_with_events(
            internal_workflow,
            start_node.name,
            initial_data,
            "manual",
            execution_repo,
        ):
            yield event

    return EventSourceResponse(event_generator())
