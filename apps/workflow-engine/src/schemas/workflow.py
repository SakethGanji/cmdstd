"""Workflow-related Pydantic schemas."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class NodeDefinitionSchema(BaseModel):
    """Schema for node definition in a workflow."""

    name: str = Field(..., description="Unique name for this node in the workflow")
    type: str = Field(..., description="Node type identifier")
    label: str | None = Field(None, description="Display label for the node")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Node parameters")
    position: dict[str, float] | None = Field(None, description="UI position {x, y}")
    retry_on_fail: int = Field(0, ge=0, description="Number of retries on failure")
    retry_delay: int = Field(1000, ge=0, description="Delay between retries in ms")
    continue_on_fail: bool = Field(False, description="Continue execution on failure")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "http_request_1",
                "type": "HttpRequest",
                "parameters": {"url": "https://api.example.com", "method": "GET"},
                "position": {"x": 100, "y": 200},
            }
        }


class ConnectionSchema(BaseModel):
    """Schema for connection between nodes."""

    source_node: str = Field(..., description="Source node name")
    target_node: str = Field(..., description="Target node name")
    source_output: str = Field("main", description="Source output name")
    target_input: str = Field("main", description="Target input name")
    connection_type: Literal["normal", "subnode"] = Field(
        "normal", description="Connection type: normal for data flow, subnode for configuration"
    )
    slot_name: str | None = Field(None, description="Slot name for subnode connections")

    class Config:
        json_schema_extra = {
            "example": {
                "source_node": "start",
                "target_node": "http_request_1",
                "source_output": "main",
                "target_input": "main",
                "connection_type": "normal",
            }
        }


class WorkflowCreateRequest(BaseModel):
    """Request schema for creating a workflow."""

    name: str = Field(..., min_length=1, max_length=255, description="Workflow name")
    nodes: list[NodeDefinitionSchema] = Field(..., min_length=1, description="List of nodes")
    connections: list[ConnectionSchema] = Field(
        default_factory=list, description="List of connections"
    )
    description: str | None = Field(None, max_length=1000, description="Workflow description")
    settings: dict[str, Any] = Field(default_factory=dict, description="Workflow settings")
    # For ad-hoc execution with input
    input_data: dict[str, Any] | None = Field(None, alias="_input_data", description="Input data for ad-hoc execution")


class WorkflowUpdateRequest(BaseModel):
    """Request schema for updating a workflow."""

    name: str | None = Field(None, min_length=1, max_length=255, description="Workflow name")
    nodes: list[NodeDefinitionSchema] | None = Field(None, description="List of nodes")
    connections: list[ConnectionSchema] | None = Field(None, description="List of connections")
    description: str | None = Field(None, max_length=1000, description="Workflow description")
    settings: dict[str, Any] | None = Field(None, description="Workflow settings")


class ActiveToggleRequest(BaseModel):
    """Request schema for toggling workflow active state."""

    active: bool = Field(..., description="Whether the workflow should be active")


class WorkflowResponse(BaseModel):
    """Response schema for workflow creation."""

    id: str
    name: str
    active: bool
    webhook_url: str
    created_at: str


class WorkflowListItem(BaseModel):
    """Schema for workflow in list response."""

    id: str
    name: str
    active: bool
    webhook_url: str
    node_count: int
    created_at: str
    updated_at: str


class WorkflowDetailResponse(BaseModel):
    """Detailed workflow response."""

    id: str
    name: str
    active: bool
    webhook_url: str
    definition: dict[str, Any]
    created_at: str
    updated_at: str


class WorkflowActiveResponse(BaseModel):
    """Response for active toggle."""

    id: str
    active: bool
