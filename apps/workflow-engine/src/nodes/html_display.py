"""HTMLDisplay node - displays HTML content in the output panel."""

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


class HTMLDisplayNode(BaseNode):
    """
    HTMLDisplay Node.

    Pass-through node that ensures HTML content is marked for rendering.
    Extracts HTML from a specified field and marks it with _renderAs: 'html'
    for the frontend to render in an iframe.
    """

    node_description = NodeTypeDescription(
        name="HTMLDisplay",
        display_name="HTML Display",
        icon="fa:code",
        description="Displays HTML content in an iframe in the output panel",
        group=["output"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs=[
            NodeOutputDefinition(
                name="main",
                display_name="HTML Output",
                schema={
                    "type": "object",
                    "properties": {
                        "html": {"type": "string", "description": "HTML content to display"},
                        "_renderAs": {"type": "string", "description": 'Render hint (always "html")'},
                    },
                },
            )
        ],
        properties=[
            NodeProperty(
                display_name="Content",
                name="content",
                type="string",
                default="",
                description="HTML content or expression (e.g. {{ $json.html }}). If empty, uses htmlField lookup.",
            ),
            NodeProperty(
                display_name="HTML Field",
                name="htmlField",
                type="string",
                default="html",
                description="Field name in input data containing the HTML content",
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "HTMLDisplay"

    @property
    def description(self) -> str:
        return "Displays HTML content in the output panel"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        from ..engine.types import NodeData as ND
        from ..engine.expression_engine import ExpressionEngine, expression_engine

        raw_content = self.get_parameter(node_definition, "content", "")
        html_field = self.get_parameter(node_definition, "htmlField", "html")

        results: list[ND] = []
        items = input_data if input_data else [ND(json={})]

        for item in items:
            html: str | None = None

            # 1. Resolve content expression per-item (handles skipped $json)
            if raw_content and isinstance(raw_content, str) and "{{" in raw_content:
                expr_ctx = ExpressionEngine.create_context(
                    [item], context.node_states, context.execution_id,
                )
                html = expression_engine.resolve(raw_content, expr_ctx, skip_json=False)
            elif raw_content:
                html = raw_content

            # 2. Field lookup from input data
            if not html:
                html = item.json.get(html_field)

            if not html:
                raise ValueError(
                    f'Missing HTML content. Tried "content" parameter and field "{html_field}". '
                    "Make sure the upstream node provides this field."
                )

            results.append(ND(json={"html": html, "_renderAs": "html"}))

        return self.output(results)
