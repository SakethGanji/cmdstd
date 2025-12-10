"""Webhook routes for triggering workflows."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from ..engine.workflow_runner import WorkflowRunner
from ..engine.types import NodeData
from ..storage.workflow_store import workflow_store
from ..storage.execution_store import execution_store

router = APIRouter()


@router.post("/webhook/{workflow_id}")
async def handle_webhook(workflow_id: str, request: Request) -> dict[str, Any]:
    """Handle incoming webhook to trigger a workflow."""
    stored = workflow_store.get(workflow_id)

    if not stored:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if not stored.active:
        raise HTTPException(status_code=400, detail="Workflow is not active")

    # Check if workflow has a Webhook node
    webhook_node = next(
        (n for n in stored.workflow.nodes if n.type == "Webhook"),
        None,
    )

    if not webhook_node:
        raise HTTPException(status_code=400, detail="Workflow has no Webhook trigger")

    # Get request data
    try:
        body = await request.json()
    except Exception:
        body = {}

    headers = dict(request.headers)
    query_params = dict(request.query_params)

    # Build webhook data
    webhook_data = NodeData(json={
        "body": body,
        "headers": headers,
        "query": query_params,
        "method": request.method,
        "triggeredAt": datetime.now().isoformat(),
    })

    # Execute workflow
    runner = WorkflowRunner()
    context = await runner.run(
        stored.workflow,
        webhook_node.name,
        [webhook_data],
        "webhook",
    )

    execution_store.complete(context, stored.id, stored.name)

    # Check response mode
    response_mode = webhook_node.parameters.get("responseMode", "onReceived")

    if response_mode == "lastNode" and context.node_states:
        # Return output from last executed node
        last_node_data = list(context.node_states.values())[-1]
        return {
            "status": "success" if not context.errors else "failed",
            "executionId": context.execution_id,
            "data": [d.json for d in last_node_data],
        }

    return {
        "status": "success" if not context.errors else "failed",
        "executionId": context.execution_id,
        "message": "Workflow triggered",
    }


@router.get("/webhook/{workflow_id}")
async def handle_webhook_get(workflow_id: str, request: Request) -> dict[str, Any]:
    """Handle GET webhook requests."""
    stored = workflow_store.get(workflow_id)

    if not stored:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if not stored.active:
        raise HTTPException(status_code=400, detail="Workflow is not active")

    # Check if workflow has a Webhook node that accepts GET
    webhook_node = next(
        (n for n in stored.workflow.nodes if n.type == "Webhook"),
        None,
    )

    if not webhook_node:
        raise HTTPException(status_code=400, detail="Workflow has no Webhook trigger")

    allowed_method = webhook_node.parameters.get("method", "POST")
    if allowed_method != "GET":
        raise HTTPException(status_code=405, detail="Method not allowed for this webhook")

    # Build webhook data
    webhook_data = NodeData(json={
        "body": {},
        "headers": dict(request.headers),
        "query": dict(request.query_params),
        "method": "GET",
        "triggeredAt": datetime.now().isoformat(),
    })

    # Execute workflow
    runner = WorkflowRunner()
    context = await runner.run(
        stored.workflow,
        webhook_node.name,
        [webhook_data],
        "webhook",
    )

    execution_store.complete(context, stored.id, stored.name)

    return {
        "status": "success" if not context.errors else "failed",
        "executionId": context.execution_id,
        "message": "Workflow triggered",
    }


async def _handle_webhook_with_method(
    workflow_id: str, request: Request, method: str
) -> dict[str, Any]:
    """Common handler for PUT and DELETE webhook requests."""
    stored = workflow_store.get(workflow_id)

    if not stored:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if not stored.active:
        raise HTTPException(status_code=400, detail="Workflow is not active")

    # Check if workflow has a Webhook node that accepts this method
    webhook_node = next(
        (n for n in stored.workflow.nodes if n.type == "Webhook"),
        None,
    )

    if not webhook_node:
        raise HTTPException(status_code=400, detail="Workflow has no Webhook trigger")

    allowed_method = webhook_node.parameters.get("method", "POST")
    if allowed_method != method:
        raise HTTPException(status_code=405, detail="Method not allowed for this webhook")

    # Get request data
    try:
        body = await request.json()
    except Exception:
        body = {}

    # Build webhook data
    webhook_data = NodeData(json={
        "body": body,
        "headers": dict(request.headers),
        "query": dict(request.query_params),
        "method": method,
        "triggeredAt": datetime.now().isoformat(),
    })

    # Execute workflow
    runner = WorkflowRunner()
    context = await runner.run(
        stored.workflow,
        webhook_node.name,
        [webhook_data],
        "webhook",
    )

    execution_store.complete(context, stored.id, stored.name)

    # Check response mode
    response_mode = webhook_node.parameters.get("responseMode", "onReceived")

    if response_mode == "lastNode" and context.node_states:
        # Return output from last executed node
        last_node_data = list(context.node_states.values())[-1]
        return {
            "status": "success" if not context.errors else "failed",
            "executionId": context.execution_id,
            "data": [d.json for d in last_node_data],
        }

    return {
        "status": "success" if not context.errors else "failed",
        "executionId": context.execution_id,
        "message": "Workflow triggered",
    }


@router.put("/webhook/{workflow_id}")
async def handle_webhook_put(workflow_id: str, request: Request) -> dict[str, Any]:
    """Handle PUT webhook requests."""
    return await _handle_webhook_with_method(workflow_id, request, "PUT")


@router.delete("/webhook/{workflow_id}")
async def handle_webhook_delete(workflow_id: str, request: Request) -> dict[str, Any]:
    """Handle DELETE webhook requests."""
    return await _handle_webhook_with_method(workflow_id, request, "DELETE")