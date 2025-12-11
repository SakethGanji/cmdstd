"""Workflow service for business logic."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from ..core.exceptions import (
    WorkflowNotFoundError,
    WorkflowExecutionError,
    WorkflowInactiveError,
    ValidationError,
)
from ..engine.types import (
    Workflow,
    NodeDefinition,
    Connection,
    NodeData,
)
from ..engine.workflow_runner import WorkflowRunner
from ..schemas.workflow import (
    WorkflowCreateRequest,
    WorkflowUpdateRequest,
    WorkflowListItem,
    WorkflowDetailResponse,
    WorkflowResponse,
    WorkflowActiveResponse,
)
from ..schemas.execution import ExecutionResponse, ExecutionErrorSchema

if TYPE_CHECKING:
    from ..repositories import WorkflowRepository, ExecutionRepository


class WorkflowService:
    """Service for workflow operations."""

    def __init__(
        self,
        workflow_repo: WorkflowRepository,
        execution_repo: ExecutionRepository,
    ) -> None:
        self._workflow_repo = workflow_repo
        self._execution_repo = execution_repo

    async def list_workflows(self) -> list[WorkflowListItem]:
        """List all workflows."""
        workflows = await self._workflow_repo.list()
        return [
            WorkflowListItem(
                id=w.id,
                name=w.name,
                active=w.active,
                webhook_url=f"/webhook/{w.id}",
                node_count=len(w.workflow.nodes),
                created_at=w.created_at.isoformat(),
                updated_at=w.updated_at.isoformat(),
            )
            for w in workflows
        ]

    async def get_workflow(self, workflow_id: str) -> WorkflowDetailResponse:
        """Get a workflow by ID."""
        stored = await self._workflow_repo.get(workflow_id)
        if not stored:
            raise WorkflowNotFoundError(workflow_id)

        return WorkflowDetailResponse(
            id=stored.id,
            name=stored.name,
            active=stored.active,
            webhook_url=f"/webhook/{stored.id}",
            definition=self._workflow_to_dict(stored.workflow),
            created_at=stored.created_at.isoformat(),
            updated_at=stored.updated_at.isoformat(),
        )

    async def create_workflow(self, request: WorkflowCreateRequest) -> WorkflowResponse:
        """Create a new workflow."""
        self._validate_workflow(request)

        internal_workflow = self._request_to_workflow(request)
        stored = await self._workflow_repo.create(internal_workflow)

        return WorkflowResponse(
            id=stored.id,
            name=stored.name,
            active=stored.active,
            webhook_url=f"/webhook/{stored.id}",
            created_at=stored.created_at.isoformat(),
        )

    async def update_workflow(
        self, workflow_id: str, request: WorkflowUpdateRequest
    ) -> WorkflowDetailResponse:
        """Update an existing workflow."""
        existing = await self._workflow_repo.get(workflow_id)
        if not existing:
            raise WorkflowNotFoundError(workflow_id)

        # Build updated workflow from existing + request
        internal_workflow = Workflow(
            name=request.name or existing.workflow.name,
            nodes=[
                NodeDefinition(
                    name=n.name,
                    type=n.type,
                    parameters=n.parameters,
                    position=n.position,
                    retry_on_fail=n.retry_on_fail,
                    retry_delay=n.retry_delay,
                    continue_on_fail=n.continue_on_fail,
                )
                for n in (request.nodes or [])
            ]
            if request.nodes
            else existing.workflow.nodes,
            connections=[
                Connection(
                    source_node=c.source_node,
                    target_node=c.target_node,
                    source_output=c.source_output,
                    target_input=c.target_input,
                )
                for c in (request.connections or [])
            ]
            if request.connections
            else existing.workflow.connections,
            id=workflow_id,
            description=request.description or existing.workflow.description,
            settings=request.settings or existing.workflow.settings,
        )

        updated = await self._workflow_repo.update(workflow_id, internal_workflow)
        if not updated:
            raise WorkflowNotFoundError(workflow_id)

        return WorkflowDetailResponse(
            id=updated.id,
            name=updated.name,
            active=updated.active,
            webhook_url=f"/webhook/{updated.id}",
            definition=self._workflow_to_dict(updated.workflow),
            created_at=updated.created_at.isoformat(),
            updated_at=updated.updated_at.isoformat(),
        )

    async def delete_workflow(self, workflow_id: str) -> bool:
        """Delete a workflow."""
        deleted = await self._workflow_repo.delete(workflow_id)
        if not deleted:
            raise WorkflowNotFoundError(workflow_id)
        return True

    async def set_active(self, workflow_id: str, active: bool) -> WorkflowActiveResponse:
        """Set workflow active state."""
        updated = await self._workflow_repo.set_active(workflow_id, active)
        if not updated:
            raise WorkflowNotFoundError(workflow_id)

        return WorkflowActiveResponse(id=updated.id, active=updated.active)

    async def run_workflow(self, workflow_id: str) -> ExecutionResponse:
        """Run a saved workflow."""
        stored = await self._workflow_repo.get(workflow_id)
        if not stored:
            raise WorkflowNotFoundError(workflow_id)

        runner = WorkflowRunner()
        start_node = runner.find_start_node(stored.workflow)

        if not start_node:
            raise WorkflowExecutionError(
                "No start node found in workflow", workflow_id=workflow_id
            )

        initial_data = [
            NodeData(
                json={
                    "triggeredAt": datetime.now().isoformat(),
                    "mode": "manual",
                }
            )
        ]

        context = await runner.run(stored.workflow, start_node.name, initial_data, "manual")
        await self._execution_repo.complete(context, stored.id, stored.name)

        return self._build_execution_response(context)

    async def run_adhoc_workflow(self, request: WorkflowCreateRequest) -> ExecutionResponse:
        """Run an ad-hoc workflow without saving."""
        self._validate_workflow(request)
        internal_workflow = self._request_to_workflow(request)

        runner = WorkflowRunner()
        start_node = runner.find_start_node(internal_workflow)

        if not start_node:
            raise WorkflowExecutionError("No start node found in workflow")

        initial_data = [
            NodeData(
                json={
                    "triggeredAt": datetime.now().isoformat(),
                    "mode": "manual",
                }
            )
        ]

        context = await runner.run(
            internal_workflow, start_node.name, initial_data, "manual"
        )
        await self._execution_repo.complete(
            context, internal_workflow.id or "adhoc", internal_workflow.name
        )

        return self._build_execution_response(context)

    def _validate_workflow(self, request: WorkflowCreateRequest) -> None:
        """Validate workflow request."""
        if not request.nodes:
            raise ValidationError("Workflow must have at least one node", field="nodes")

        node_names = [n.name for n in request.nodes]
        if len(node_names) != len(set(node_names)):
            raise ValidationError("Node names must be unique", field="nodes")

        # Validate connections reference valid nodes
        for conn in request.connections:
            if conn.source_node not in node_names:
                raise ValidationError(
                    f"Connection references unknown source node: {conn.source_node}",
                    field="connections",
                )
            if conn.target_node not in node_names:
                raise ValidationError(
                    f"Connection references unknown target node: {conn.target_node}",
                    field="connections",
                )

    def _request_to_workflow(self, request: WorkflowCreateRequest) -> Workflow:
        """Convert request to internal Workflow type."""
        return Workflow(
            name=request.name,
            nodes=[
                NodeDefinition(
                    name=n.name,
                    type=n.type,
                    parameters=n.parameters,
                    position=n.position,
                    retry_on_fail=n.retry_on_fail,
                    retry_delay=n.retry_delay,
                    continue_on_fail=n.continue_on_fail,
                )
                for n in request.nodes
            ],
            connections=[
                Connection(
                    source_node=c.source_node,
                    target_node=c.target_node,
                    source_output=c.source_output,
                    target_input=c.target_input,
                )
                for c in request.connections
            ],
            description=request.description,
            settings=request.settings,
        )

    def _workflow_to_dict(self, workflow: Workflow) -> dict[str, Any]:
        """Convert internal Workflow to dict for API response."""
        return {
            "name": workflow.name,
            "id": workflow.id,
            "description": workflow.description,
            "nodes": [
                {
                    "name": n.name,
                    "type": n.type,
                    "parameters": n.parameters,
                    "position": n.position,
                    "retry_on_fail": n.retry_on_fail,
                    "retry_delay": n.retry_delay,
                    "continue_on_fail": n.continue_on_fail,
                }
                for n in workflow.nodes
            ],
            "connections": [
                {
                    "source_node": c.source_node,
                    "target_node": c.target_node,
                    "source_output": c.source_output,
                    "target_input": c.target_input,
                }
                for c in workflow.connections
            ],
            "settings": workflow.settings,
        }

    def _build_execution_response(self, context: Any) -> ExecutionResponse:
        """Build execution response from context."""
        node_data = {
            name: [{"json": d.json} for d in data]
            for name, data in context.node_states.items()
        }

        return ExecutionResponse(
            status="failed" if context.errors else "success",
            execution_id=context.execution_id,
            data=node_data,
            errors=[
                ExecutionErrorSchema(
                    node_name=e.node_name,
                    error=e.error,
                    timestamp=e.timestamp.isoformat(),
                )
                for e in context.errors
            ],
        )
