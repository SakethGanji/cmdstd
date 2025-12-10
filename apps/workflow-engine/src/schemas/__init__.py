"""Pydantic schemas for API request/response validation."""

from .workflow import (
    NodeDefinitionSchema,
    ConnectionSchema,
    WorkflowCreateRequest,
    WorkflowUpdateRequest,
    WorkflowResponse,
    WorkflowListItem,
    WorkflowDetailResponse,
    ActiveToggleRequest,
    WorkflowActiveResponse,
)
from .execution import (
    ExecutionResponse,
    ExecutionListItem,
    ExecutionDetailResponse,
)
from .node import (
    NodeTypeInfo,
    NodePropertySchema,
)
from .common import (
    SuccessResponse,
    ErrorResponse,
    PaginatedResponse,
    HealthResponse,
    RootResponse,
)

__all__ = [
    # Workflow schemas
    "NodeDefinitionSchema",
    "ConnectionSchema",
    "WorkflowCreateRequest",
    "WorkflowUpdateRequest",
    "WorkflowResponse",
    "WorkflowListItem",
    "WorkflowDetailResponse",
    "ActiveToggleRequest",
    "WorkflowActiveResponse",
    # Execution schemas
    "ExecutionResponse",
    "ExecutionListItem",
    "ExecutionDetailResponse",
    # Node schemas
    "NodeTypeInfo",
    "NodePropertySchema",
    # Common schemas
    "SuccessResponse",
    "ErrorResponse",
    "PaginatedResponse",
    "HealthResponse",
    "RootResponse",
]
