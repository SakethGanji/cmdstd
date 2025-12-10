"""Execution service for business logic."""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..core.exceptions import ExecutionNotFoundError
from ..schemas.execution import (
    ExecutionListItem,
    ExecutionDetailResponse,
    ExecutionErrorSchema,
)

if TYPE_CHECKING:
    from ..storage.execution_store import ExecutionStore
    from ..storage.workflow_store import WorkflowStore


class ExecutionService:
    """Service for execution operations."""

    def __init__(
        self,
        execution_store: ExecutionStore,
        workflow_store: WorkflowStore,
    ) -> None:
        self._execution_store = execution_store
        self._workflow_store = workflow_store

    def list_executions(self, workflow_id: str | None = None) -> list[ExecutionListItem]:
        """List execution history."""
        executions = self._execution_store.list(workflow_id)

        return [
            ExecutionListItem(
                id=e.id,
                workflow_id=e.workflow_id,
                workflow_name=e.workflow_name,
                status=e.status,
                mode=e.mode,
                start_time=e.start_time.isoformat(),
                end_time=e.end_time.isoformat() if e.end_time else None,
                error_count=len(e.errors),
            )
            for e in executions
        ]

    def get_execution(self, execution_id: str) -> ExecutionDetailResponse:
        """Get execution details."""
        execution = self._execution_store.get(execution_id)
        if not execution:
            raise ExecutionNotFoundError(execution_id)

        return ExecutionDetailResponse(
            id=execution.id,
            workflow_id=execution.workflow_id,
            workflow_name=execution.workflow_name,
            status=execution.status,
            mode=execution.mode,
            start_time=execution.start_time.isoformat(),
            end_time=execution.end_time.isoformat() if execution.end_time else None,
            errors=[
                ExecutionErrorSchema(
                    node_name=e.node_name,
                    error=e.error,
                    timestamp=e.timestamp.isoformat(),
                )
                for e in execution.errors
            ],
            node_data={
                name: [{"json": d.json} for d in data]
                for name, data in execution.node_data.items()
            },
        )

    def delete_execution(self, execution_id: str) -> bool:
        """Delete an execution record."""
        deleted = self._execution_store.delete(execution_id)
        if not deleted:
            raise ExecutionNotFoundError(execution_id)
        return True

    def clear_executions(self) -> int:
        """Clear all execution records and return count."""
        count = len(self._execution_store.list())
        self._execution_store.clear()
        return count
