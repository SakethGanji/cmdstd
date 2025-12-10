"""Core type definitions for the workflow engine."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Literal


class NoOutputSignal:
    """Special signal to indicate a branch produced no output (for Merge node)."""

    _instance: NoOutputSignal | None = None

    def __new__(cls) -> NoOutputSignal:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __repr__(self) -> str:
        return "NO_OUTPUT_SIGNAL"


NO_OUTPUT_SIGNAL = NoOutputSignal()


@dataclass
class NodeData:
    """Data item passed between nodes."""

    json: dict[str, Any]
    binary: dict[str, bytes] | None = None


@dataclass
class ExecutionContext:
    """Context for a workflow execution."""

    workflow: Workflow
    execution_id: str
    start_time: datetime
    mode: Literal["manual", "webhook", "cron"]

    # Node execution state
    node_states: dict[str, list[NodeData]] = field(default_factory=dict)

    # For loop support: track execution per iteration
    node_run_counts: dict[str, int] = field(default_factory=dict)

    # For Merge node: track which inputs have been received
    pending_inputs: dict[str, dict[str, list[NodeData] | NoOutputSignal]] = field(
        default_factory=dict
    )

    # For SplitInBatches: stateful node data
    node_internal_state: dict[str, dict[str, Any]] = field(default_factory=dict)

    # Error tracking
    errors: list[ExecutionError] = field(default_factory=list)

    # For Wait node webhook resume
    waiting_nodes: dict[str, Any] = field(default_factory=dict)

    # Shared HTTP client for performance
    http_client: Any | None = None  # httpx.AsyncClient


@dataclass
class ExecutionError:
    """Error that occurred during execution."""

    node_name: str
    error: str
    timestamp: datetime


@dataclass
class NodeExecutionResult:
    """
    Multi-output result from node execution.

    Keys are output names: "main", "true", "false", "loop", "done", etc.
    None value signals that branch should propagate NO_OUTPUT_SIGNAL.
    """

    outputs: dict[str, list[NodeData] | None]


@dataclass
class ExecutionJob:
    """Job in the execution queue."""

    node_name: str
    input_data: list[NodeData]
    source_node: str | None
    source_output: str
    run_index: int


@dataclass
class ExecutionRecord:
    """Execution record for history."""

    id: str
    workflow_id: str
    workflow_name: str
    status: Literal["running", "success", "failed"]
    mode: Literal["manual", "webhook", "cron"]
    start_time: datetime
    end_time: datetime | None = None
    node_data: dict[str, list[NodeData]] = field(default_factory=dict)
    errors: list[ExecutionError] = field(default_factory=list)


@dataclass
class StoredWorkflow:
    """Stored workflow with metadata."""

    id: str
    name: str
    workflow: Workflow
    active: bool
    created_at: datetime
    updated_at: datetime


class ExecutionEventType(str, Enum):
    """Types of execution events for SSE streaming."""

    EXECUTION_START = "execution:start"
    NODE_START = "node:start"
    NODE_COMPLETE = "node:complete"
    NODE_ERROR = "node:error"
    EXECUTION_COMPLETE = "execution:complete"
    EXECUTION_ERROR = "execution:error"


@dataclass
class ExecutionEvent:
    """Real-time execution event for SSE streaming."""

    type: ExecutionEventType
    execution_id: str
    timestamp: datetime
    node_name: str | None = None
    node_type: str | None = None
    data: list[NodeData] | None = None
    error: str | None = None
    progress: dict[str, int] | None = None


# Callback type for receiving execution events
ExecutionEventCallback = Callable[[ExecutionEvent], None]


# --- Workflow Schema Types ---


@dataclass
class NodeDefinition:
    """Definition of a node in a workflow."""

    name: str
    type: str
    parameters: dict[str, Any] = field(default_factory=dict)
    position: dict[str, float] | None = None
    pinned_data: list[NodeData] | None = None
    retry_on_fail: int = 0
    retry_delay: int = 1000
    continue_on_fail: bool = False


@dataclass
class Connection:
    """Connection between two nodes."""

    source_node: str
    target_node: str
    source_output: str = "main"
    target_input: str = "main"


@dataclass
class Workflow:
    """Workflow definition."""

    name: str
    nodes: list[NodeDefinition]
    connections: list[Connection]
    id: str | None = None
    description: str | None = None
    settings: dict[str, Any] = field(default_factory=dict)
