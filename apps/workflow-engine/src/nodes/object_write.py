"""ObjectWrite node - write data to the shared object store."""

from __future__ import annotations

import json
from typing import Any, TYPE_CHECKING

from .base import (
    BaseNode,
    NodeTypeDescription,
    NodeInputDefinition,
    NodeOutputDefinition,
    NodeProperty,
    NodePropertyOption,
)
from .object_store import set_value, merge_values

if TYPE_CHECKING:
    from ..engine.types import ExecutionContext, NodeData, NodeDefinition, NodeExecutionResult


class ObjectWriteNode(BaseNode):
    """Write data to the shared object store."""

    node_description = NodeTypeDescription(
        name="ObjectWrite",
        display_name="Object Write",
        description="Write data to the shared object store",
        icon="fa:upload",
        group=["transform"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs=[
            NodeOutputDefinition(
                name="main",
                display_name="Output",
                schema={
                    "type": "object",
                    "description": "Passthrough input data with write confirmation",
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
                display_name="Mode",
                name="mode",
                type="options",
                default="set",
                options=[
                    NodePropertyOption(
                        name="Set",
                        value="set",
                        description="Set a single key-value pair",
                    ),
                    NodePropertyOption(
                        name="Merge",
                        value="merge",
                        description="Merge a JSON object into the namespace",
                    ),
                ],
            ),
            NodeProperty(
                display_name="Key",
                name="key",
                type="string",
                default="",
                required=True,
                description="Key to write (supports expressions)",
                placeholder="history",
                display_options={"show": {"mode": ["set"]}},
            ),
            NodeProperty(
                display_name="Value",
                name="value",
                type="string",
                default="",
                description="Value to write (supports expressions like {{ $json.data }})",
                placeholder="{{ $json.data }}",
                type_options={"rows": 4},
                display_options={"show": {"mode": ["set"]}},
            ),
            NodeProperty(
                display_name="JSON Data",
                name="jsonData",
                type="json",
                default="{}",
                type_options={"language": "json", "rows": 6},
                description="JSON object to merge into the namespace",
                display_options={"show": {"mode": ["merge"]}},
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "ObjectWrite"

    @property
    def description(self) -> str:
        return "Write data to the shared object store"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        from ..engine.types import NodeData as NodeDataClass
        from ..engine.expression_engine import ExpressionEngine, expression_engine

        namespace_template = self.get_parameter(node_definition, "namespace", "default")
        mode = self.get_parameter(node_definition, "mode", "set")

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

            # Resolve namespace expression
            namespace = expression_engine.resolve(namespace_template, expr_context)
            if not namespace:
                namespace = "default"

            if mode == "set":
                key_template = self.get_parameter(node_definition, "key", "")
                value_template = self.get_parameter(node_definition, "value", "")

                # Resolve key and value expressions
                key = expression_engine.resolve(key_template, expr_context) if key_template else ""
                value = expression_engine.resolve(value_template, expr_context) if value_template else ""

                if key:
                    # Try to parse value as JSON if it looks like JSON
                    parsed_value: Any = value
                    if isinstance(value, str) and value.strip():
                        try:
                            parsed_value = json.loads(value)
                        except json.JSONDecodeError:
                            # Keep as string if not valid JSON
                            parsed_value = value

                    set_value(namespace, key, parsed_value)

            elif mode == "merge":
                json_data = self.get_parameter(node_definition, "jsonData", {})

                if isinstance(json_data, str):
                    try:
                        json_data = json.loads(json_data)
                    except json.JSONDecodeError:
                        json_data = {}

                if isinstance(json_data, dict):
                    merge_values(namespace, json_data)

            # Passthrough with write confirmation
            new_json: dict[str, Any] = dict(item.json)
            new_json["_objectWrite"] = {
                "namespace": namespace,
                "mode": mode,
                "success": True,
            }

            results.append(NodeDataClass(json=new_json, binary=item.binary))

        return self.output(results)
