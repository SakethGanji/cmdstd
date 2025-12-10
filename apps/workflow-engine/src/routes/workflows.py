"""Workflow routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from ..core.exceptions import (
    WorkflowNotFoundError,
    WorkflowExecutionError,
    ValidationError,
)
from ..core.dependencies import get_workflow_service
from ..services.workflow_service import WorkflowService
from ..schemas.workflow import (
    WorkflowCreateRequest,
    WorkflowUpdateRequest,
    WorkflowResponse,
    WorkflowListItem,
    WorkflowDetailResponse,
    ActiveToggleRequest,
    WorkflowActiveResponse,
)
from ..schemas.execution import ExecutionResponse
from ..schemas.common import SuccessResponse

router = APIRouter(prefix="/workflows")


# Type alias for dependency injection
WorkflowServiceDep = Annotated[WorkflowService, Depends(get_workflow_service)]


@router.get("", response_model=list[WorkflowListItem])
async def list_workflows(service: WorkflowServiceDep) -> list[WorkflowListItem]:
    """List all workflows."""
    return service.list_workflows()


@router.get("/{workflow_id}", response_model=WorkflowDetailResponse)
async def get_workflow(
    workflow_id: str,
    service: WorkflowServiceDep,
) -> WorkflowDetailResponse:
    """Get a single workflow by ID."""
    try:
        return service.get_workflow(workflow_id)
    except WorkflowNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.post("", response_model=WorkflowResponse, status_code=201)
async def create_workflow(
    workflow: WorkflowCreateRequest,
    service: WorkflowServiceDep,
) -> WorkflowResponse:
    """Create a new workflow."""
    try:
        return service.create_workflow(workflow)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.put("/{workflow_id}", response_model=WorkflowDetailResponse)
async def update_workflow(
    workflow_id: str,
    workflow: WorkflowUpdateRequest,
    service: WorkflowServiceDep,
) -> WorkflowDetailResponse:
    """Update an existing workflow."""
    try:
        return service.update_workflow(workflow_id, workflow)
    except WorkflowNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.delete("/{workflow_id}", response_model=SuccessResponse)
async def delete_workflow(
    workflow_id: str,
    service: WorkflowServiceDep,
) -> SuccessResponse:
    """Delete a workflow."""
    try:
        service.delete_workflow(workflow_id)
        return SuccessResponse(message="Workflow deleted")
    except WorkflowNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.patch("/{workflow_id}/active", response_model=WorkflowActiveResponse)
async def toggle_workflow_active(
    workflow_id: str,
    body: ActiveToggleRequest,
    service: WorkflowServiceDep,
) -> WorkflowActiveResponse:
    """Toggle workflow active state."""
    try:
        return service.set_active(workflow_id, body.active)
    except WorkflowNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.post("/{workflow_id}/run", response_model=ExecutionResponse)
async def run_workflow(
    workflow_id: str,
    service: WorkflowServiceDep,
) -> ExecutionResponse:
    """Run a saved workflow."""
    try:
        return await service.run_workflow(workflow_id)
    except WorkflowNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except WorkflowExecutionError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/run-adhoc", response_model=ExecutionResponse)
async def run_adhoc_workflow(
    workflow: WorkflowCreateRequest,
    service: WorkflowServiceDep,
) -> ExecutionResponse:
    """Run an ad-hoc workflow without saving."""
    try:
        return await service.run_adhoc_workflow(workflow)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except WorkflowExecutionError as e:
        raise HTTPException(status_code=400, detail=e.message)
