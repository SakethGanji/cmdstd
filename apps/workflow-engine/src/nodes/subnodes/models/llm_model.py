"""LLM model subnode for AI agents."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

from ...base import (
    NodeProperty,
    NodePropertyOption,
    NodeTypeDescription,
)
from ..base_subnode import BaseSubnode

if TYPE_CHECKING:
    from ....engine.types import NodeDefinition


class LLMModelNode(BaseSubnode):
    """LLM model configuration subnode."""

    node_description = NodeTypeDescription(
        name="LLMModel",
        display_name="LLM Model",
        description="LLM model configuration",
        icon="fa:microchip",
        group=["ai"],
        inputs=[],
        outputs=[],
        properties=[
            NodeProperty(
                display_name="Model",
                name="model",
                type="options",
                default="gemini-2.0-flash",
                options=[
                    NodePropertyOption(name="Gemini 2.0 Flash", value="gemini-2.0-flash"),
                    NodePropertyOption(name="Gemini 1.5 Flash", value="gemini-1.5-flash"),
                    NodePropertyOption(name="Gemini 1.5 Pro", value="gemini-1.5-pro"),
                    NodePropertyOption(name="GPT-4o", value="gpt-4o"),
                    NodePropertyOption(name="GPT-4o Mini", value="gpt-4o-mini"),
                    NodePropertyOption(name="Claude Sonnet", value="claude-sonnet-4-20250514"),
                ],
            ),
            NodeProperty(
                display_name="Temperature",
                name="temperature",
                type="number",
                default=0.7,
                description="Controls randomness (0-1)",
            ),
            NodeProperty(
                display_name="Max Tokens",
                name="maxTokens",
                type="number",
                default=4096,
                description="Maximum response length",
            ),
        ],
        is_subnode=True,
        subnode_type="model",
        provides_to_slot="chatModel",
    )

    def get_config(self, node_definition: NodeDefinition) -> dict[str, Any]:
        """Return LLM model configuration."""
        return {
            "model": self.get_parameter(node_definition, "model", "gemini-2.0-flash"),
            "temperature": self.get_parameter(node_definition, "temperature", 0.7),
            "maxTokens": self.get_parameter(node_definition, "maxTokens", 4096),
        }
