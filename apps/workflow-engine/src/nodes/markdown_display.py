"""MarkdownDisplay node - displays Markdown content in the output panel."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .base import (
    BaseNode,
    NodeTypeDescription,
    NodeInputDefinition,
    NodeOutputDefinition,
    NodeProperty,
)

if TYPE_CHECKING:
    from ..engine.types import (
        ExecutionContext,
        NodeData,
        NodeDefinition,
        NodeExecutionResult,
    )


class MarkdownDisplayNode(BaseNode):
    """
    MarkdownDisplay Node.

    Pass-through node that ensures Markdown content is marked for rendering.
    Extracts Markdown from a specified field and marks it with _renderAs: 'markdown'
    for the frontend to render as formatted text.
    """

    node_description = NodeTypeDescription(
        name="MarkdownDisplay",
        display_name="Markdown Display",
        icon="fa:file-text",
        description="Displays Markdown content as formatted text in the output panel",
        group=["output"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs=[
            NodeOutputDefinition(
                name="main",
                display_name="Markdown Output",
                schema={
                    "type": "object",
                    "properties": {
                        "markdown": {"type": "string", "description": "Markdown content to display"},
                        "_renderAs": {"type": "string", "description": 'Render hint (always "markdown")'},
                    },
                },
            )
        ],
        properties=[
            NodeProperty(
                display_name="Markdown Field",
                name="markdownField",
                type="string",
                default="markdown",
                description="Field name in input data containing the Markdown content. Can also use 'text', 'content', 'message', or 'summary'.",
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "MarkdownDisplay"

    @property
    def description(self) -> str:
        return "Displays Markdown content in the output panel"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        from ..engine.types import NodeData as ND

        markdown_field = self.get_parameter(node_definition, "markdownField", "markdown")

        results: list[ND] = []
        items = input_data if input_data else [ND(json={})]

        # Common field names for markdown/text content
        fallback_fields = ["markdown", "text", "content", "message", "summary", "body"]

        for item in items:
            # Try the specified field first
            markdown = item.json.get(markdown_field)

            # If not found, try fallback fields
            if not markdown:
                for field in fallback_fields:
                    if field in item.json and isinstance(item.json[field], str):
                        markdown = item.json[field]
                        break

            if not markdown:
                raise ValueError(
                    f'Missing Markdown content. Tried field "{markdown_field}" and fallbacks {fallback_fields}. '
                    "Make sure the upstream node provides text content."
                )

            results.append(ND(json={"markdown": markdown, "_renderAs": "markdown"}))

        return self.output(results)
