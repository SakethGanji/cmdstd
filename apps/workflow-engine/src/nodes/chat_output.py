"""Chat Output node - display messages in chat interface."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .base import (
    BaseNode,
    NodeTypeDescription,
    NodeInputDefinition,
    NodeOutputDefinition,
    NodeProperty,
    NodePropertyOption,
)

if TYPE_CHECKING:
    from ..engine.types import ExecutionContext, NodeData, NodeDefinition, NodeExecutionResult


class ChatOutputNode(BaseNode):
    """Chat output - displays messages in the UI chat interface."""

    node_description = NodeTypeDescription(
        name="ChatOutput",
        display_name="Chat Output",
        description="Display message in chat interface",
        icon="fa:comment-dots",
        group=["ui", "output"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs=[
            NodeOutputDefinition(
                name="main",
                display_name="Output",
                schema={
                    "type": "object",
                    "properties": {
                        "message": {"type": "string", "description": "Message content"},
                        "_uiType": {"type": "string", "description": "UI rendering type"},
                        "_messageType": {"type": "string", "description": "Message type (assistant/system)"},
                    },
                },
            )
        ],
        properties=[
            NodeProperty(
                display_name="Message Field",
                name="messageField",
                type="string",
                default="message",
                description="Field name containing the message text",
            ),
            NodeProperty(
                display_name="Message Type",
                name="messageType",
                type="options",
                default="assistant",
                options=[
                    NodePropertyOption(name="Assistant", value="assistant"),
                    NodePropertyOption(name="System", value="system"),
                ],
                description="Type of message for styling",
            ),
            NodeProperty(
                display_name="Format",
                name="format",
                type="options",
                default="text",
                options=[
                    NodePropertyOption(name="Plain Text", value="text"),
                    NodePropertyOption(name="Markdown", value="markdown"),
                ],
                description="How to render the message content",
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "ChatOutput"

    @property
    def description(self) -> str:
        return "Display message in chat interface"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        from ..engine.types import NodeData as ND

        message_field = self.get_parameter(node_definition, "messageField", "message")
        message_type = self.get_parameter(node_definition, "messageType", "assistant")
        format_type = self.get_parameter(node_definition, "format", "text")

        results: list[ND] = []
        items = input_data if input_data else [ND(json={})]

        for item in items:
            # Try to get message from specified field, or use entire json as message
            message = item.json.get(message_field)

            # If message field not found, try common alternatives
            if message is None:
                message = item.json.get("content") or item.json.get("text") or item.json.get("response")

            if message is None:
                # Use string representation of json if no message field found
                message = str(item.json) if item.json else ""

            # Add UI metadata for frontend rendering
            results.append(ND(json={
                "message": message,
                "_uiType": "chat",
                "_messageType": message_type,
                "_format": format_type,
            }))

        return self.output(results)
