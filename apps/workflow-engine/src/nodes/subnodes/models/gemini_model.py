"""Gemini model subnode for AI agents."""

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


class GeminiModelNode(BaseSubnode):
    """Gemini model configuration subnode."""

    node_description = NodeTypeDescription(
        name="GeminiModel",
        display_name="Gemini",
        description="Google Gemini model configuration",
        icon="fa:google",
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
        """Return Gemini model configuration."""
        import os

        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            raise ValueError(
                "GEMINI_API_KEY environment variable is required. "
                "Set it with: export GEMINI_API_KEY=your-api-key"
            )

        return {
            "provider": "gemini",
            "model": self.get_parameter(node_definition, "model", "gemini-2.0-flash"),
            "temperature": self.get_parameter(node_definition, "temperature", 0.7),
            "maxTokens": self.get_parameter(node_definition, "maxTokens", 4096),
            "apiKey": api_key,
        }
