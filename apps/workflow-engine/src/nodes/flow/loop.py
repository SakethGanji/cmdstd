"""Loop node - iterate until condition is met or max iterations reached."""

from __future__ import annotations

import os
from typing import Any, TYPE_CHECKING

from ..base import (
    BaseNode,
    NodeTypeDescription,
    NodeInputDefinition,
    NodeOutputDefinition,
    NodeProperty,
)
from ...engine.expression_engine import ExpressionEngine, ExpressionContext

if TYPE_CHECKING:
    from ...engine.types import ExecutionContext, NodeData, NodeDefinition, NodeExecutionResult


class LoopNode(BaseNode):
    """Loop node - iterate until exit condition is true or max iterations reached."""

    node_description = NodeTypeDescription(
        name="Loop",
        display_name="Loop",
        description="Central loop controller (n8n style). Routes to 'continue' for testing, 'loop' for improvement, 'done' for exit.",
        icon="fa:sync",
        group=["flow"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs=[
            NodeOutputDefinition(
                name="continue",
                display_name="Continue",
                schema={"type": "unknown", "description": "Continue to test - routes to Test Prompt"},
            ),
            NodeOutputDefinition(
                name="loop",
                display_name="Loop",
                schema={"type": "unknown", "description": "Needs improvement - routes to Analyze"},
            ),
            NodeOutputDefinition(
                name="done",
                display_name="Done",
                schema={"type": "unknown", "description": "Exit loop - condition met or max iterations reached"},
            ),
        ],
        properties=[
            NodeProperty(
                display_name="Max Iterations",
                name="maxIterations",
                type="number",
                default=10,
                description="Maximum number of loop iterations (prevents infinite loops)",
            ),
            NodeProperty(
                display_name="Exit Condition",
                name="exitCondition",
                type="string",
                default="",
                placeholder="{{ $json.done == true }}",
                description="Expression that evaluates to true when loop should exit. Leave empty to only use max iterations.",
            ),
            NodeProperty(
                display_name="Counter Field",
                name="counterField",
                type="string",
                default="_loopIteration",
                description="Field name to store current iteration number in output",
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "Loop"

    @property
    def description(self) -> str:
        return "Iterate until condition is met or max iterations reached"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        from ...engine.types import NodeData

        max_iterations = int(self.get_parameter(node_definition, "maxIterations", 10))
        exit_condition = self.get_parameter(node_definition, "exitCondition", "")
        counter_field = self.get_parameter(node_definition, "counterField", "_loopIteration")

        # Get or initialize internal state
        state_key = node_definition.name
        state: dict[str, Any] = context.node_internal_state.get(state_key, {})

        if "iteration" not in state:
            state = {"iteration": 0}

        # Increment iteration
        state["iteration"] += 1
        current_iteration = state["iteration"]

        # Check max iterations
        max_reached = current_iteration >= max_iterations

        # Evaluate exit condition if provided
        condition_met = False
        if exit_condition and exit_condition.strip():
            try:
                expression_engine = ExpressionEngine()
                # Build context for expression evaluation
                json_data = input_data[0].json if input_data else {}
                # Add iteration info to context
                eval_context = {
                    **json_data,
                    counter_field: current_iteration,
                    "_maxIterations": max_iterations,
                }

                # Build node_data dict for expression context
                node_data_dict = {}
                for node_name, node_state in context.node_states.items():
                    if node_state:
                        node_data_dict[node_name] = {"json": node_state[0].json if node_state else {}}

                # Create expression context
                expr_context = ExpressionContext(
                    json_data=eval_context,
                    input_data=[NodeData(json=eval_context)],
                    node_data=node_data_dict,
                    env=dict(os.environ),
                    execution={"id": context.execution_id, "mode": context.mode},
                    item_index=0,
                )

                # Evaluate the expression
                result = expression_engine.resolve(exit_condition, expr_context)

                # Convert result to boolean - handle various formats
                if isinstance(result, bool):
                    condition_met = result
                elif isinstance(result, (int, float)):
                    condition_met = bool(result)
                elif result == exit_condition:
                    # Expression wasn't resolved (returned unchanged) - treat as false
                    condition_met = False
                else:
                    condition_met = str(result).strip().lower() in ("true", "1", "yes")
            except Exception as e:
                # Log but don't fail - just use max iterations
                print(f"[Loop] Warning: Could not evaluate exit condition '{exit_condition}': {e}")
                condition_met = False

        # Determine if we should exit
        should_exit = condition_met or max_reached

        # Check if coming from Prep Next (ready to test) via _readyToTest flag
        ready_to_test = False
        if input_data:
            ready_to_test = input_data[0].json.get("_readyToTest", False)

        # Prepare output data with iteration info (and clear _readyToTest flag)
        output_items = []
        for item in input_data:
            enriched = {
                **item.json,
                counter_field: current_iteration,
                "_loopMaxReached": max_reached,
                "_loopConditionMet": condition_met,
            }
            # Clear the _readyToTest flag so it doesn't persist
            enriched.pop("_readyToTest", None)
            output_items.append(NodeData(json=enriched))

        # Three-way routing (n8n style):
        # 1. If _readyToTest is set → 'continue' (route to Test Prompt)
        # 2. Else if exit condition met → 'done' (route to Build Report)
        # 3. Else → 'loop' (route to Analyze for improvement)

        if ready_to_test:
            # Coming from Set Initial Prompt or Prep Next - route to Test Prompt
            # Don't increment iteration here, just pass through
            context.node_internal_state[state_key] = state
            return self.outputs({
                "continue": output_items,
                "loop": None,
                "done": None,
            })
        elif should_exit:
            # Exit condition met or max reached - route to Build Report
            context.node_internal_state.pop(state_key, None)
            return self.outputs({
                "continue": None,
                "loop": None,
                "done": output_items,
            })
        else:
            # Needs improvement - route to Analyze
            context.node_internal_state[state_key] = state
            return self.outputs({
                "continue": None,
                "loop": output_items,
                "done": None,
            })
