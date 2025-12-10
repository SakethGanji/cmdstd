"""Webhook routes for triggering workflows."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request

from ..core.exceptions import (
    WorkflowNotFoundError,
    WorkflowInactiveError,
    WebhookError,
)
from ..core.dependencies import get_workflow_store, get_execution_store
from ..services.webhook_service import WebhookService
from ..storage.workflow_store import WorkflowStore
from ..storage.execution_store import ExecutionStore

router = APIRouter()


def get_webhook_service(
    workflow_store: Annotated[WorkflowStore, Depends(get_workflow_store)],
    execution_store: Annotated[ExecutionStore, Depends(get_execution_store)],
) -> WebhookService:
    """Get webhook service instance."""
    return WebhookService(workflow_store, execution_store)


WebhookServiceDep = Annotated[WebhookService, Depends(get_webhook_service)]


async def _extract_request_data(request: Request) -> tuple[dict[str, Any], dict[str, str], dict[str, str]]:
    """Extract body, headers, and query params from request."""
    try:
        body = await request.json()
    except Exception:
        body = {}

    headers = dict(request.headers)
    query_params = dict(request.query_params)

    return body, headers, query_params


@router.post("/webhook/{workflow_id}")
async def handle_webhook_post(
    workflow_id: str,
    request: Request,
    service: WebhookServiceDep,
) -> dict[str, Any]:
    """Handle POST webhook to trigger a workflow."""
    body, headers, query_params = await _extract_request_data(request)

    try:
        return await service.handle_webhook(
            workflow_id=workflow_id,
            method="POST",
            body=body,
            headers=headers,
            query_params=query_params,
        )
    except WorkflowNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except WorkflowInactiveError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except WebhookError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/webhook/{workflow_id}")
async def handle_webhook_get(
    workflow_id: str,
    request: Request,
    service: WebhookServiceDep,
) -> dict[str, Any]:
    """Handle GET webhook to trigger a workflow."""
    _, headers, query_params = await _extract_request_data(request)

    try:
        return await service.handle_webhook(
            workflow_id=workflow_id,
            method="GET",
            body={},
            headers=headers,
            query_params=query_params,
        )
    except WorkflowNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except WorkflowInactiveError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except WebhookError as e:
        raise HTTPException(status_code=405, detail=e.message)


@router.put("/webhook/{workflow_id}")
async def handle_webhook_put(
    workflow_id: str,
    request: Request,
    service: WebhookServiceDep,
) -> dict[str, Any]:
    """Handle PUT webhook to trigger a workflow."""
    body, headers, query_params = await _extract_request_data(request)

    try:
        return await service.handle_webhook(
            workflow_id=workflow_id,
            method="PUT",
            body=body,
            headers=headers,
            query_params=query_params,
        )
    except WorkflowNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except WorkflowInactiveError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except WebhookError as e:
        raise HTTPException(status_code=405, detail=e.message)


@router.delete("/webhook/{workflow_id}")
async def handle_webhook_delete(
    workflow_id: str,
    request: Request,
    service: WebhookServiceDep,
) -> dict[str, Any]:
    """Handle DELETE webhook to trigger a workflow."""
    body, headers, query_params = await _extract_request_data(request)

    try:
        return await service.handle_webhook(
            workflow_id=workflow_id,
            method="DELETE",
            body=body,
            headers=headers,
            query_params=query_params,
        )
    except WorkflowNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except WorkflowInactiveError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except WebhookError as e:
        raise HTTPException(status_code=405, detail=e.message)
