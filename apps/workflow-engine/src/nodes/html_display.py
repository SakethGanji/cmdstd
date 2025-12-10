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

        html_field = self.get_parameter(node_definition, "htmlField", "html")

        results: list[ND] = []
        items = input_data if input_data else [ND(json={})]

        for item in items:
            html = item.json.get(html_field)

            if not html:
                raise ValueError(
                    f'Missing HTML content in field "{html_field}". '
                    "Make sure the upstream node provides this field."
                )

            results.append(ND(json={"html": html, "_renderAs": "html"}))

        return self.output(results)
