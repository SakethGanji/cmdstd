"""Node service for business logic."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..core.exceptions import NodeNotFoundError

if TYPE_CHECKING:
    from ..engine.node_registry import NodeRegistry


class NodeService:
    """Service for node operations."""

    def __init__(self, node_registry: NodeRegistry) -> None:
        self._node_registry = node_registry

    def list_nodes(self) -> list[dict[str, Any]]:
        """List all available node types with schemas."""
        nodes = self._node_registry.get_node_info_full()

        return [
            {
                "type": n.type,
                "displayName": n.display_name,
                "description": n.description,
                "icon": n.icon,
                "group": n.group,
                "inputCount": n.input_count,
                "outputCount": n.output_count,
                "properties": n.properties,
                "inputs": n.inputs,
                "outputs": n.outputs,
                "inputStrategy": n.input_strategy,
                "outputStrategy": n.output_strategy,
                # Subnode fields
                "isSubnode": n.is_subnode,
                "subnodeType": n.subnode_type,
                "providesToSlot": n.provides_to_slot,
                "subnodeSlots": n.subnode_slots,
            }
            for n in nodes
        ]

    def get_node(self, node_type: str) -> dict[str, Any]:
        """Get schema for a specific node type."""
        info = self._node_registry.get_node_type_info(node_type)
        if not info:
            raise NodeNotFoundError(node_type)

        return {
            "type": info.type,
            "displayName": info.display_name,
            "description": info.description,
            "icon": info.icon,
            "group": info.group,
            "inputCount": info.input_count,
            "outputCount": info.output_count,
            "properties": info.properties,
            "inputs": info.inputs,
            "outputs": info.outputs,
            "inputStrategy": info.input_strategy,
            "outputStrategy": info.output_strategy,
            # Subnode fields
            "isSubnode": info.is_subnode,
            "subnodeType": info.subnode_type,
            "providesToSlot": info.provides_to_slot,
            "subnodeSlots": info.subnode_slots,
        }

    def get_nodes_by_group(self, group: str) -> list[dict[str, Any]]:
        """Get nodes filtered by group."""
        all_nodes = self.list_nodes()
        return [n for n in all_nodes if group in n.get("group", [])]
