"""In-memory workflow storage for POC."""

from __future__ import annotations

import time
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..engine.types import StoredWorkflow, Workflow


class WorkflowStore:
    """In-memory workflow storage for POC."""

    def __init__(self) -> None:
        self._workflows: dict[str, StoredWorkflow] = {}

    def create(self, workflow: Workflow) -> StoredWorkflow:
        """Create a new workflow."""
        from ..engine.types import StoredWorkflow, Workflow as WorkflowType

        workflow_id = workflow.id or self._generate_id()

        # Create a copy of workflow with the ID set
        stored_workflow = WorkflowType(
            name=workflow.name,
            nodes=workflow.nodes,
            connections=workflow.connections,
            id=workflow_id,
            description=workflow.description,
            settings=workflow.settings,
        )

        stored = StoredWorkflow(
            id=workflow_id,
            name=workflow.name,
            workflow=stored_workflow,
            active=False,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

        self._workflows[workflow_id] = stored
        return stored

    def get(self, workflow_id: str) -> StoredWorkflow | None:
        """Get a workflow by ID."""
        return self._workflows.get(workflow_id)

    def get_by_webhook_path(self, path: str) -> StoredWorkflow | None:
        """Get a workflow by webhook path."""
        # Webhook path format: /webhook/:workflowId
        workflow_id = path.replace("/webhook/", "")
        stored = self._workflows.get(workflow_id)
        if stored and stored.active:
            return stored
        return None

    def list(self) -> list[StoredWorkflow]:
        """List all workflows."""
        return list(self._workflows.values())

    def update(self, workflow_id: str, workflow: Workflow) -> StoredWorkflow | None:
        """Update an existing workflow."""
        from ..engine.types import Workflow as WorkflowType

        existing = self._workflows.get(workflow_id)
        if not existing:
            return None

        # Create updated workflow
        updated_workflow = WorkflowType(
            name=workflow.name or existing.name,
            nodes=workflow.nodes,
            connections=workflow.connections,
            id=workflow_id,
            description=workflow.description or existing.workflow.description,
            settings=workflow.settings or existing.workflow.settings,
        )

        existing.name = updated_workflow.name
        existing.workflow = updated_workflow
        existing.updated_at = datetime.now()

        return existing

    def set_active(self, workflow_id: str, active: bool) -> StoredWorkflow | None:
        """Set workflow active state."""
        existing = self._workflows.get(workflow_id)
        if not existing:
            return None

        existing.active = active
        existing.updated_at = datetime.now()
        return existing

    def delete(self, workflow_id: str) -> bool:
        """Delete a workflow."""
        if workflow_id in self._workflows:
            del self._workflows[workflow_id]
            return True
        return False

    def clear(self) -> None:
        """Clear all workflows."""
        self._workflows.clear()

    def _generate_id(self) -> str:
        """Generate a unique workflow ID."""
        return f"wf_{int(time.time() * 1000)}_{uuid.uuid4().hex[:7]}"


# Singleton instance
workflow_store = WorkflowStore()
