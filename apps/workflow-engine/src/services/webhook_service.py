"""Webhook service for handling webhook triggers."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from ..core.exceptions import (
    WorkflowNotFoundError,
    WorkflowInactiveError,
    WebhookError,
)
from ..engine.types import NodeData, WebhookResponse
from ..engine.workflow_runner import WorkflowRunner
from ..schemas.execution import ExecutionResponse, ExecutionErrorSchema

if TYPE_CHECKING:
    from ..repositories import WorkflowRepository, ExecutionRepository


class WebhookService:
    """Service for webhook operations."""

    def __init__(
        self,
        workflow_repo: WorkflowRepository,
        execution_repo: ExecutionRepository,
    ) -> None:
        self._workflow_repo = workflow_repo
        self._execution_repo = execution_repo

    async def handle_webhook(
        self,
        workflow_id: str,
        method: str,
        body: dict[str, Any],
        headers: dict[str, str],
        query_params: dict[str, str],
    ) -> dict[str, Any] | WebhookResponse:
        """Handle incoming webhook request.

        Returns either a dict (default response) or WebhookResponse (custom response from node).
        """
        stored = await self._workflow_repo.get(workflow_id)
        if not stored:
            raise WorkflowNotFoundError(workflow_id)

        if not stored.active:
            raise WorkflowInactiveError(workflow_id)

        # Find webhook node
        webhook_node = next(
            (n for n in stored.workflow.nodes if n.type == "Webhook"),
            None,
        )
        if not webhook_node:
            raise WebhookError("Workflow has no Webhook trigger", workflow_id)

        # Check method is allowed
        allowed_method = webhook_node.parameters.get("method", "POST")
        if method != "POST" and allowed_method != method:
            raise WebhookError(
                f"Method {method} not allowed for this webhook", workflow_id
            )

        # Build webhook data
        webhook_data = NodeData(
            json={
                "body": body,
                "headers": headers,
                "query": query_params,
                "method": method,
                "triggeredAt": datetime.now().isoformat(),
            }
        )

        # Execute workflow
        runner = WorkflowRunner()
        context = await runner.run(
            stored.workflow,
            webhook_node.name,
            [webhook_data],
            "webhook",
            workflow_repository=self._workflow_repo,
        )

        await self._execution_repo.complete(context, stored.id, stored.name)

        # Check if a RespondToWebhook node set a custom response
        if context.webhook_response:
            return context.webhook_response

        # Check response mode from Webhook node configuration
        response_mode = webhook_node.parameters.get("responseMode", "onReceived")

        if response_mode == "lastNode" and context.node_states:
            last_node_data = list(context.node_states.values())[-1]
            return {
                "status": "success" if not context.errors else "failed",
                "executionId": context.execution_id,
                "data": [d.json for d in last_node_data],
            }

        return {
            "status": "success" if not context.errors else "failed",
            "executionId": context.execution_id,
            "message": "Workflow triggered",
        }
