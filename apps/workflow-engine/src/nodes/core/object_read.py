"""ObjectRead node - read data from the shared object store."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

from ..base import (
    BaseNode,
    NodeTypeDescription,
    NodeInputDefinition,
    NodeOutputDefinition,
    NodeProperty,
)
from .object_store import get_value

if TYPE_CHECKING:
    from ...engine.types import ExecutionContext, NodeData, NodeDefinition, NodeExecutionResult


class ObjectReadNode(BaseNode):
    """Read data from the shared object store."""

    node_description = NodeTypeDescription(
        name="ObjectRead",
        display_name="Object Read",
        description="Read data from the shared object store",
        icon="fa:download",
        group=["transform"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs=[
            NodeOutputDefinition(
                name="main",
                display_name="Output",
                schema={
                    "type": "object",
                    "description": "Input data merged with retrieved value",
                },
            )
        ],
        properties=[
            NodeProperty(
                display_name="Namespace",
                name="namespace",
                type="string",
                default="default",
                description="Storage namespace for isolation (supports expressions)",
                placeholder="default",
            ),
            NodeProperty(
                display_name="Key",
                name="key",
                type="string",
                default="",
                description="Key to read. Leave empty to read entire namespace.",
                placeholder="history",
            ),
            NodeProperty(
                display_name="Output Field",
                name="outputField",
                type="string",
                default="data",
                description="Field name to store the retrieved value",
                placeholder="data",
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "ObjectRead"

    @property
    def description(self) -> str:
        return "Read data from the shared object store"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        from ...engine.types import NodeData as NodeDataClass
        from ...engine.expression_engine import ExpressionEngine, expression_engine

        namespace_template = self.get_parameter(node_definition, "namespace", "default")
        key_template = self.get_parameter(node_definition, "key", "")
        output_field = self.get_parameter(node_definition, "outputField", "data")

        results: list[NodeDataClass] = []
        items = input_data if input_data else [NodeDataClass(json={})]

        for idx, item in enumerate(items):
            # Create expression context for this item
            expr_context = ExpressionEngine.create_context(
                input_data,
                context.node_states,
                context.execution_id,
                idx,
            )

            # Resolve namespace and key expressions
            namespace = expression_engine.resolve(namespace_template, expr_context)
            if not namespace:
                namespace = "default"

            key = expression_engine.resolve(key_template, expr_context) if key_template else ""

            # Read from store
            if key:
                value = get_value(namespace, key)
            else:
                value = get_value(namespace)

            # Merge with existing data
            new_json: dict[str, Any] = dict(item.json)
            new_json[output_field] = value

            results.append(NodeDataClass(json=new_json, binary=item.binary))

        return self.output(results)
