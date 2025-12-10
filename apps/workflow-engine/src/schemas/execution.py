"""Execution-related Pydantic schemas."""

from typing import Any

from pydantic import BaseModel, Field


class ExecutionErrorSchema(BaseModel):
    """Schema for execution error."""

    node_name: str
    error: str
    timestamp: str


class ExecutionResponse(BaseModel):
    """Response schema for workflow execution."""

    status: str = Field(..., description="Execution status: success or failed")
    execution_id: str = Field(..., description="Unique execution ID")
    data: dict[str, Any] = Field(..., description="Output data from each node")
    errors: list[ExecutionErrorSchema] = Field(
        default_factory=list, description="List of errors"
    )


class ExecutionListItem(BaseModel):
    """Schema for execution in list response."""

    id: str
    workflow_id: str
    workflow_name: str
    status: str
    mode: str
    start_time: str
    end_time: str | None
    error_count: int


class ExecutionDetailResponse(BaseModel):
    """Detailed execution response."""

    id: str
    workflow_id: str
    workflow_name: str
    status: str
    mode: str
    start_time: str
    end_time: str | None
    errors: list[ExecutionErrorSchema]
    node_data: dict[str, Any]


class ExecutionStreamEvent(BaseModel):
    """Schema for SSE execution event."""

    type: str
    execution_id: str
    timestamp: str
    node_name: str | None = None
    node_type: str | None = None
    data: list[dict[str, Any]] | None = None
    error: str | None = None
    progress: dict[str, int] | None = None
