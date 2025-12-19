"""Base class for subnode types."""

from __future__ import annotations

from abc import abstractmethod
from typing import Any, TYPE_CHECKING

from ..base import BaseNode

if TYPE_CHECKING:
    from ...engine.types import (
        ExecutionContext,
        NodeData,
        NodeDefinition,
        NodeExecutionResult,
    )


class BaseSubnode(BaseNode):
    """
    Base class for subnode types.

    Subnodes don't execute in the normal workflow flow - they provide
    configuration to their parent nodes (like AI Agent).
    """

    @property
    def type(self) -> str:
        """Node type identifier."""
        if self.node_description:
            return self.node_description.name
        raise NotImplementedError("Subnode must define node_description")

    @property
    def description(self) -> str:
        """Short description of what the node does."""
        if self.node_description:
            return self.node_description.description
        return "Subnode"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        """
        Subnodes don't execute in normal flow - they provide config.

        This method should not be called during normal workflow execution.
        """
        raise NotImplementedError(
            f"Subnode '{self.type}' should not be executed directly. "
            "It provides configuration to parent nodes."
        )

    @abstractmethod
    def get_config(self, node_definition: NodeDefinition) -> dict[str, Any]:
        """
        Return configuration for parent node to use.

        This is the main method subnodes implement - it returns a dict
        containing all the configuration the parent node needs.
        """
        ...
