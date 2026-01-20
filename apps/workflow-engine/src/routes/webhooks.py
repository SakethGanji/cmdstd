"""Webhook routes for triggering workflows."""

from __future__ import annotations

import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse, HTMLResponse, Response

from ..core.exceptions import (
    WorkflowNotFoundError,
    WorkflowInactiveError,
    WebhookError,
)
from ..core.dependencies import get_workflow_repository, get_execution_repository
from ..engine.types import WebhookResponse
from ..services.webhook_service import WebhookService
from ..repositories import WorkflowRepository, ExecutionRepository

router = APIRouter()


def _build_response(result: dict[str, Any] | WebhookResponse) -> Response:
    """Build appropriate FastAPI response from service result."""
    if isinstance(result, WebhookResponse):
        # Custom response from RespondToWebhook node
        headers = result.headers or {}

        if result.body is None:
            # No content response
            return Response(
                status_code=result.status_code,
                headers=headers,
            )

        if result.content_type == "text/plain":
            return PlainTextResponse(
                content=str(result.body),
                status_code=result.status_code,
                headers=headers,
            )
        elif result.content_type == "text/html":
            return HTMLResponse(
                content=str(result.body),
                status_code=result.status_code,
                headers=headers,
            )
        else:
            # Default to JSON
            return JSONResponse(
                content=result.body,
                status_code=result.status_code,
                headers=headers,
            )
    else:
        # Standard dict response
        return JSONResponse(content=result)


def get_webhook_service(
    workflow_repo: Annotated[WorkflowRepository, Depends(get_workflow_repository)],
    execution_repo: Annotated[ExecutionRepository, Depends(get_execution_repository)],
) -> WebhookService:
    """Get webhook service instance."""
    return WebhookService(workflow_repo, execution_repo)


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
) -> Response:
    """Handle POST webhook to trigger a workflow."""
    body, headers, query_params = await _extract_request_data(request)

    try:
        result = await service.handle_webhook(
            workflow_id=workflow_id,
            method="POST",
            body=body,
            headers=headers,
            query_params=query_params,
        )
        return _build_response(result)
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
) -> Response:
    """Handle GET webhook to trigger a workflow."""
    _, headers, query_params = await _extract_request_data(request)

    try:
        result = await service.handle_webhook(
            workflow_id=workflow_id,
            method="GET",
            body={},
            headers=headers,
            query_params=query_params,
        )
        return _build_response(result)
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
) -> Response:
    """Handle PUT webhook to trigger a workflow."""
    body, headers, query_params = await _extract_request_data(request)

    try:
        result = await service.handle_webhook(
            workflow_id=workflow_id,
            method="PUT",
            body=body,
            headers=headers,
            query_params=query_params,
        )
        return _build_response(result)
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
) -> Response:
    """Handle DELETE webhook to trigger a workflow."""
    body, headers, query_params = await _extract_request_data(request)

    try:
        result = await service.handle_webhook(
            workflow_id=workflow_id,
            method="DELETE",
            body=body,
            headers=headers,
            query_params=query_params,
        )
        return _build_response(result)
    except WorkflowNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except WorkflowInactiveError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except WebhookError as e:
        raise HTTPException(status_code=405, detail=e.message)
