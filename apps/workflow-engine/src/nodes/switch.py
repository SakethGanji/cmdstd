"""Switch node - route items to different outputs based on conditions."""

from __future__ import annotations

import re
from typing import Any, TYPE_CHECKING

from .base import (
    BaseNode,
    NodeTypeDescription,
    NodeInputDefinition,
    NodeProperty,
    NodePropertyOption,
)

if TYPE_CHECKING:
    from ..engine.types import ExecutionContext, NodeData, NodeDefinition, NodeExecutionResult


class SwitchNode(BaseNode):
    """Switch node - route items to different outputs based on conditions."""

    node_description = NodeTypeDescription(
        name="Switch",
        display_name="Switch",
        description="Route items to different outputs based on conditions",
        icon="fa:random",
        group=["flow"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs="dynamic",
        output_strategy={
            "type": "dynamicFromCollection",
            "collectionName": "rules",
            "addFallback": True,
        },
        properties=[
            NodeProperty(
                display_name="Mode",
                name="mode",
                type="options",
                default="rules",
                options=[
                    NodePropertyOption(
                        name="Rules",
                        value="rules",
                        description="Evaluate conditions against each item",
                    ),
                    NodePropertyOption(
                        name="Expression",
                        value="expression",
                        description="Use expression to determine output",
                    ),
                ],
            ),
            NodeProperty(
                display_name="Rules",
                name="rules",
                type="collection",
                default=[],
                type_options={"multipleValues": True},
                display_options={"show": {"mode": ["rules"]}},
                properties=[
                    NodeProperty(
                        display_name="Output Index",
                        name="output",
                        type="number",
                        default=0,
                        type_options={"minValue": 0},
                        description="Which output to route matching items to",
                    ),
                    NodeProperty(
                        display_name="Field",
                        name="field",
                        type="string",
                        default="",
                        placeholder="status",
                        description="Field path to evaluate (supports dot notation)",
                    ),
                    NodeProperty(
                        display_name="Operation",
                        name="operation",
                        type="options",
                        default="equals",
                        options=[
                            NodePropertyOption(name="Equals", value="equals"),
                            NodePropertyOption(name="Not Equals", value="notEquals"),
                            NodePropertyOption(name="Contains", value="contains"),
                            NodePropertyOption(name="Not Contains", value="notContains"),
                            NodePropertyOption(name="Starts With", value="startsWith"),
                            NodePropertyOption(name="Ends With", value="endsWith"),
                            NodePropertyOption(name="Greater Than", value="gt"),
                            NodePropertyOption(name="Greater or Equal", value="gte"),
                            NodePropertyOption(name="Less Than", value="lt"),
                            NodePropertyOption(name="Less or Equal", value="lte"),
                            NodePropertyOption(name="Is Empty", value="isEmpty"),
                            NodePropertyOption(name="Is Not Empty", value="isNotEmpty"),
                            NodePropertyOption(name="Regex Match", value="regex"),
                            NodePropertyOption(name="Is True", value="isTrue"),
                            NodePropertyOption(name="Is False", value="isFalse"),
                        ],
                    ),
                    NodeProperty(
                        display_name="Value",
                        name="value",
                        type="string",
                        default="",
                        description="Value to compare against. Supports expressions.",
                        display_options={"hide": {"operation": ["isEmpty", "isNotEmpty", "isTrue", "isFalse"]}},
                    ),
                ],
            ),
            NodeProperty(
                display_name="Expression",
                name="expression",
                type="string",
                default="0",
                description="Expression that evaluates to output index (0-based)",
                display_options={"show": {"mode": ["expression"]}},
            ),
            NodeProperty(
                display_name="Fallback Output",
                name="fallbackOutput",
                type="number",
                default=0,
                type_options={"minValue": 0},
                description="Output index when no rules match",
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "Switch"

    @property
    def description(self) -> str:
        return "Route items to different outputs based on conditions"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        mode = self.get_parameter(node_definition, "mode", "rules")
        rules = self.get_parameter(node_definition, "rules", [])
        fallback_output = self.get_parameter(node_definition, "fallback", "fallback")
        # Also support "field" for simple value routing
        field_path = self.get_parameter(node_definition, "field", "")

        # Initialize output buckets based on rules
        outputs: dict[str, list[NodeData]] = {}

        # If using simple field mode with string output names
        if field_path and rules:
            for rule in rules:
                output_name = str(rule.get("output", ""))
                if output_name:
                    outputs[output_name] = []
            outputs[str(fallback_output)] = []

            for item in input_data:
                field_value = self._get_nested_value(item.json, field_path)
                matched = False
                for rule in rules:
                    if field_value == rule.get("value"):
                        output_name = str(rule.get("output", ""))
                        outputs[output_name].append(item)
                        matched = True
                        break
                if not matched:
                    outputs[str(fallback_output)].append(item)
        elif mode == "expression":
            # Expression mode: evaluate expression to get output index
            expression = self.get_parameter(node_definition, "expression", "0")
            outputs["output0"] = []
            for item in input_data:
                try:
                    output_index = int(expression)
                except ValueError:
                    output_index = 0
                key = f"output{output_index}"
                if key not in outputs:
                    outputs[key] = []
                outputs[key].append(item)
        else:
            # Rules mode: evaluate each rule against each item (numeric outputs)
            for rule in rules:
                output_idx = rule.get("output", 0)
                key = f"output{output_idx}" if isinstance(output_idx, int) else str(output_idx)
                outputs[key] = []
            outputs[f"output{fallback_output}" if isinstance(fallback_output, int) else str(fallback_output)] = []

            for item in input_data:
                matched = False
                for rule in rules:
                    if self._evaluate_rule(rule, item.json):
                        output_idx = rule.get("output", 0)
                        key = f"output{output_idx}" if isinstance(output_idx, int) else str(output_idx)
                        outputs[key].append(item)
                        matched = True
                        break

                if not matched:
                    key = f"output{fallback_output}" if isinstance(fallback_output, int) else str(fallback_output)
                    outputs[key].append(item)

        # Convert empty lists to None for NO_OUTPUT signal
        result: dict[str, list[NodeData] | None] = {}
        for key, data in outputs.items():
            result[key] = data if data else None

        return self.outputs(result)

    def _evaluate_rule(self, rule: dict[str, Any], json_data: dict[str, Any]) -> bool:
        """Evaluate a single rule against JSON data."""
        field_value = self._get_nested_value(json_data, rule.get("field", ""))
        rule_value = rule.get("value")
        operation = rule.get("operation", "equals")

        if operation == "equals":
            return field_value == rule_value
        elif operation == "notEquals":
            return field_value != rule_value
        elif operation == "contains":
            return str(rule_value) in str(field_value)
        elif operation == "notContains":
            return str(rule_value) not in str(field_value)
        elif operation == "startsWith":
            return str(field_value).startswith(str(rule_value))
        elif operation == "endsWith":
            return str(field_value).endswith(str(rule_value))
        elif operation == "gt":
            try:
                return float(field_value) > float(rule_value)
            except (ValueError, TypeError):
                return False
        elif operation == "gte":
            try:
                return float(field_value) >= float(rule_value)
            except (ValueError, TypeError):
                return False
        elif operation == "lt":
            try:
                return float(field_value) < float(rule_value)
            except (ValueError, TypeError):
                return False
        elif operation == "lte":
            try:
                return float(field_value) <= float(rule_value)
            except (ValueError, TypeError):
                return False
        elif operation == "isEmpty":
            return field_value is None or field_value == "" or field_value == []
        elif operation == "isNotEmpty":
            return field_value is not None and field_value != "" and field_value != []
        elif operation == "regex":
            try:
                return bool(re.search(str(rule_value), str(field_value)))
            except re.error:
                return False
        elif operation == "isTrue":
            return field_value is True or field_value == "true" or field_value == 1
        elif operation == "isFalse":
            return field_value is False or field_value == "false" or field_value == 0
        else:
            return False

    def _get_nested_value(self, obj: dict[str, Any], path: str) -> Any:
        """Get value at nested path."""
        if not path:
            return obj
        current: Any = obj
        for key in path.split("."):
            if isinstance(current, dict):
                current = current.get(key)
            else:
                return None
        return current
