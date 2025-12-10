"""SplitInBatches node - process array items in batches."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

from .base import (
    BaseNode,
    NodeTypeDescription,
    NodeInputDefinition,
    NodeOutputDefinition,
    NodeProperty,
)

if TYPE_CHECKING:
    from ..engine.types import ExecutionContext, NodeData, NodeDefinition, NodeExecutionResult


class SplitInBatchesNode(BaseNode):
    """SplitInBatches node - process array items in batches with loop support."""

    node_description = NodeTypeDescription(
        name="SplitInBatches",
        display_name="Split In Batches",
        description="Process array items in batches with loop support",
        icon="fa:layer-group",
        group=["flow"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs=[
            NodeOutputDefinition(
                name="loop",
                display_name="Loop",
                schema={"type": "unknown", "description": "Current batch items"},
            ),
            NodeOutputDefinition(
                name="done",
                display_name="Done",
                schema={"type": "unknown", "description": "All items after processing"},
            ),
        ],
        properties=[
            NodeProperty(
                display_name="Batch Size",
                name="batchSize",
                type="number",
                default=10,
                description="Number of items per batch",
            ),
            NodeProperty(
                display_name="Reset",
                name="reset",
                type="boolean",
                default=False,
                description="Reset batch state (start from beginning)",
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "SplitInBatches"

    @property
    def description(self) -> str:
        return "Process array items in batches with loop support"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        from ..engine.types import NodeData

        batch_size = self.get_parameter(node_definition, "batchSize", 10)
        reset = self.get_parameter(node_definition, "reset", False)

        # Get or initialize internal state
        state_key = node_definition.name
        state: dict[str, Any] = context.node_internal_state.get(state_key, {})

        if reset or "items" not in state:
            # First run or reset - store all items and start at index 0
            all_items = [item.json for item in input_data]
            state = {
                "items": all_items,
                "currentIndex": 0,
                "processedItems": [],
            }

        items = state["items"]
        current_index = state["currentIndex"]

        # Get the next batch
        batch_end = min(current_index + batch_size, len(items))
        batch = items[current_index:batch_end]

        if not batch:
            # No more items - output done
            context.node_internal_state.pop(state_key, None)
            all_processed = state.get("processedItems", items)
            return self.outputs({
                "loop": None,
                "done": [NodeData(json=item) for item in all_processed],
            })

        # Update state for next iteration
        state["currentIndex"] = batch_end
        state["processedItems"].extend(batch)
        context.node_internal_state[state_key] = state

        # If there are more items, output to loop; otherwise mark as done
        has_more = batch_end < len(items)

        return self.outputs({
            "loop": [NodeData(json=item) for item in batch] if has_more else None,
            "done": None if has_more else [NodeData(json=item) for item in state["processedItems"]],
        })
