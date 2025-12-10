"""ErrorTrigger node - entry point for error handling workflows."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

from .base import (
    BaseNode,
    NodeTypeDescription,
    NodeOutputDefinition,
)

if TYPE_CHECKING:
    from ..engine.types import (
        ExecutionContext,
        NodeData,
        NodeDefinition,
        NodeExecutionResult,
    )


class ErrorTriggerNode(BaseNode):
    """
    ErrorTrigger node - entry point for error handling workflows.
    This node is triggered when another workflow fails.
    """

    node_description = NodeTypeDescription(
        name="ErrorTrigger",
        display_name="Error Trigger",
        icon="fa:exclamation-triangle",
        description="Trigger a workflow when another workflow fails",
        group=["trigger"],
        inputs=[],  # Trigger node - no inputs
        outputs=[
            NodeOutputDefinition(
                name="main",
                display_name="Output",
                schema={
                    "type": "object",
                    "properties": {
                        "failedWorkflow": {
                            "type": "object",
                            "description": "Information about the failed workflow",
                            "properties": {
                                "id": {"type": "string", "description": "Workflow ID"},
                                "name": {"type": "string", "description": "Workflow name"},
                                "executionId": {"type": "string", "description": "Execution ID"},
                            },
                        },
                        "errors": {
                            "type": "array",
                            "description": "List of errors that occurred",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "nodeName": {"type": "string", "description": "Name of the node that failed"},
                                    "message": {"type": "string", "description": "Error message"},
                                    "timestamp": {"type": "string", "description": "ISO timestamp of error"},
                                },
                            },
                        },
                        "timestamp": {"type": "string", "description": "ISO timestamp when error workflow triggered"},
                    },
                },
            )
        ],
        properties=[],  # Error data comes from the failing workflow
    )

    @property
    def type(self) -> str:
        return "ErrorTrigger"

    @property
    def description(self) -> str:
        return "Trigger a workflow when another workflow fails"

    @property
    def input_count(self) -> int:
        return 0  # Trigger node has no inputs

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        from ..engine.types import NodeData as ND

        # ErrorTrigger passes through the error data
        # The input data contains error information from the failed workflow
        return self.output(input_data if input_data else [ND(json={})])


@dataclass
class ErrorInfo:
    """Information about a single error."""

    node_name: str
    error: str
    timestamp: datetime


class ErrorWorkflowManagerClass:
    """Error workflow manager - tracks error handler workflows."""

    def __init__(self) -> None:
        # Map of workflow_id -> error_handler_workflow_id
        self._handlers: dict[str, str] = {}
        # Global error handler (catches all unhandled errors)
        self._global_handler: str | None = None

    def register(self, workflow_id: str, error_handler_workflow_id: str) -> None:
        """Register an error handler for a specific workflow."""
        self._handlers[workflow_id] = error_handler_workflow_id

    def set_global_handler(self, workflow_id: str) -> None:
        """Set global error handler."""
        self._global_handler = workflow_id

    def get_handler(self, workflow_id: str) -> str | None:
        """Get error handler for a workflow."""
        return self._handlers.get(workflow_id) or self._global_handler

    def unregister(self, workflow_id: str) -> None:
        """Remove error handler registration."""
        self._handlers.pop(workflow_id, None)

    def clear(self) -> None:
        """Clear all handlers."""
        self._handlers.clear()
        self._global_handler = None

    def create_error_data(
        self,
        failed_workflow_id: str,
        failed_workflow_name: str,
        execution_id: str,
        errors: list[ErrorInfo],
    ) -> dict:
        """Create error data for triggering error workflow."""
        from ..engine.types import NodeData

        return NodeData(
            json={
                "failedWorkflow": {
                    "id": failed_workflow_id,
                    "name": failed_workflow_name,
                    "executionId": execution_id,
                },
                "errors": [
                    {
                        "nodeName": e.node_name,
                        "message": e.error,
                        "timestamp": e.timestamp.isoformat(),
                    }
                    for e in errors
                ],
                "timestamp": datetime.now().isoformat(),
            }
        )


# Singleton instance
error_workflow_manager = ErrorWorkflowManagerClass()
