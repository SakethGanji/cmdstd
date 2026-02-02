"""ReadFile node - provides file paths for downstream processing."""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..base import (
    BaseNode,
    NodeTypeDescription,
    NodeInputDefinition,
    NodeOutputDefinition,
    NodeProperty,
)

if TYPE_CHECKING:
    from ...engine.types import (
        ExecutionContext,
        NodeData,
        NodeDefinition,
        NodeExecutionResult,
    )


class ReadFileNode(BaseNode):
    """
    ReadFile Node.

    Simple pass-through node that outputs a file path.
    Designed for future extensibility (S3, URLs, etc).
    The actual file reading is done by downstream nodes (e.g., PandasExplore).
    """

    node_description = NodeTypeDescription(
        name="ReadFile",
        display_name="Read File",
        icon="fa:file",
        description="Provides a file path for downstream processing",
        group=["input"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs=[
            NodeOutputDefinition(
                name="main",
                display_name="File Path",
                schema={
                    "type": "object",
                    "properties": {
                        "filePath": {"type": "string", "description": "Absolute path to the file"},
                    },
                },
            )
        ],
        properties=[
            NodeProperty(
                display_name="File Path",
                name="filePath",
                type="string",
                default="",
                required=True,
                placeholder="/path/to/data.csv",
                description="Absolute path to the file. Supports expressions: {{ $json.path }}",
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "ReadFile"

    @property
    def description(self) -> str:
        return "Provides a file path for downstream processing"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        from ...engine.types import NodeData as ND

        file_path = self.get_parameter(node_definition, "filePath")

        # Process each input item (or single item if no input)
        results: list[ND] = []
        items = input_data if input_data else [ND(json={})]

        for _ in items:
            results.append(ND(json={"filePath": file_path}))

        return self.output(results)
