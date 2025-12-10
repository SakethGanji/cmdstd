"""In-memory execution history storage for POC."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from ..engine.types import ExecutionContext, ExecutionRecord


class ExecutionStore:
    """In-memory execution history storage for POC."""

    def __init__(self, max_records: int = 100) -> None:
        self._executions: dict[str, ExecutionRecord] = {}
        self._max_records = max_records

    def start(
        self,
        execution_id: str,
        workflow_id: str,
        workflow_name: str,
        mode: Literal["manual", "webhook", "cron"],
    ) -> ExecutionRecord:
        """Create a new execution record when workflow starts."""
        from ..engine.types import ExecutionRecord

        record = ExecutionRecord(
            id=execution_id,
            workflow_id=workflow_id,
            workflow_name=workflow_name,
            status="running",
            mode=mode,
            start_time=datetime.now(),
        )

        self._executions[execution_id] = record
        self._cleanup()
        return record

    def complete(
        self,
        context: ExecutionContext,
        workflow_id: str,
        workflow_name: str,
    ) -> ExecutionRecord:
        """Update execution with final state."""
        from ..engine.types import ExecutionRecord

        record = self._executions.get(context.execution_id)

        if not record:
            record = ExecutionRecord(
                id=context.execution_id,
                workflow_id=workflow_id,
                workflow_name=workflow_name,
                status="running",
                mode=context.mode,
                start_time=context.start_time,
            )

        # Update record
        record.status = "failed" if context.errors else "success"
        record.end_time = datetime.now()
        record.node_data = dict(context.node_states)
        record.errors = list(context.errors)

        self._executions[context.execution_id] = record
        return record

    def get(self, execution_id: str) -> ExecutionRecord | None:
        """Get an execution record by ID."""
        return self._executions.get(execution_id)

    def list(self, workflow_id: str | None = None) -> list[ExecutionRecord]:
        """List execution records, optionally filtered by workflow ID."""
        records = list(self._executions.values())

        if workflow_id:
            records = [r for r in records if r.workflow_id == workflow_id]

        # Sort by start time descending
        records.sort(key=lambda r: r.start_time, reverse=True)
        return records

    def delete(self, execution_id: str) -> bool:
        """Delete an execution record."""
        if execution_id in self._executions:
            del self._executions[execution_id]
            return True
        return False

    def clear(self) -> None:
        """Clear all execution records."""
        self._executions.clear()

    def _cleanup(self) -> None:
        """Remove old records if over max."""
        if len(self._executions) > self._max_records:
            # Sort by start time and remove oldest
            sorted_records = sorted(
                self._executions.items(),
                key=lambda x: x[1].start_time,
            )
            to_delete = sorted_records[: len(sorted_records) - self._max_records]
            for exec_id, _ in to_delete:
                del self._executions[exec_id]


# Singleton instance
execution_store = ExecutionStore()
