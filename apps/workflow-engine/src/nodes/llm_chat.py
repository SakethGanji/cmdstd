"""LLM Chat node - single-turn LLM integration."""

from __future__ import annotations

import os
from typing import Any, TYPE_CHECKING

from .base import (
    BaseNode,
    NodeTypeDescription,
    NodeInputDefinition,
    NodeOutputDefinition,
    NodeProperty,
    NodePropertyOption,
)

if TYPE_CHECKING:
    from ..engine.types import ExecutionContext, NodeData, NodeDefinition, NodeExecutionResult


class LLMChatNode(BaseNode):
    """LLM Chat node - single-turn LLM conversation."""

    node_description = NodeTypeDescription(
        name="LLMChat",
        display_name="LLM Chat",
        description="Send a message to an LLM and get a response",
        icon="fa:robot",
        group=["ai"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs=[
            NodeOutputDefinition(
                name="main",
                display_name="Response",
                schema={
                    "type": "object",
                    "properties": {
                        "response": {"type": "string", "description": "LLM response text"},
                        "model": {"type": "string", "description": "Model used"},
                        "usage": {"type": "object", "description": "Token usage stats"},
                    },
                },
            )
        ],
        properties=[
            NodeProperty(
                display_name="Provider",
                name="provider",
                type="options",
                default="anthropic",
                options=[
                    NodePropertyOption(name="Anthropic (Claude)", value="anthropic"),
                    NodePropertyOption(name="OpenAI (GPT)", value="openai"),
                ],
            ),
            NodeProperty(
                display_name="Model",
                name="model",
                type="string",
                default="claude-sonnet-4-20250514",
                placeholder="claude-sonnet-4-20250514",
                description="Model identifier",
            ),
            NodeProperty(
                display_name="System Prompt",
                name="systemPrompt",
                type="string",
                default="You are a helpful assistant.",
                description="System message to set assistant behavior",
                type_options={"rows": 3},
            ),
            NodeProperty(
                display_name="User Message",
                name="userMessage",
                type="string",
                default="",
                required=True,
                description="Message to send. Supports expressions: {{ $json.message }}",
                type_options={"rows": 5},
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
                default=1024,
                description="Maximum response length",
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "LLMChat"

    @property
    def description(self) -> str:
        return "Send a message to an LLM and get a response"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        from ..engine.types import NodeData

        provider = self.get_parameter(node_definition, "provider", "anthropic")
        model = self.get_parameter(node_definition, "model", "claude-sonnet-4-20250514")
        system_prompt = self.get_parameter(node_definition, "systemPrompt", "You are a helpful assistant.")
        user_message = self.get_parameter(node_definition, "userMessage", "")
        temperature = self.get_parameter(node_definition, "temperature", 0.7)
        max_tokens = self.get_parameter(node_definition, "maxTokens", 1024)

        if not user_message:
            raise ValueError("User message is required")

        results: list[NodeData] = []

        for _item in input_data if input_data else [NodeData(json={})]:
            if provider == "anthropic":
                result = await self._call_anthropic(
                    model=model,
                    system_prompt=system_prompt,
                    user_message=user_message,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            else:
                result = await self._call_openai(
                    model=model,
                    system_prompt=system_prompt,
                    user_message=user_message,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )

            results.append(NodeData(json=result))

        return self.output(results)

    async def _call_anthropic(
        self,
        model: str,
        system_prompt: str,
        user_message: str,
        temperature: float,
        max_tokens: int,
    ) -> dict[str, Any]:
        """Call Anthropic API."""
        try:
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

            response = await client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )

            return {
                "response": response.content[0].text if response.content else "",
                "model": response.model,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                },
            }

        except ImportError:
            raise RuntimeError("anthropic package not installed")
        except Exception as e:
            raise RuntimeError(f"Anthropic API error: {e}")

    async def _call_openai(
        self,
        model: str,
        system_prompt: str,
        user_message: str,
        temperature: float,
        max_tokens: int,
    ) -> dict[str, Any]:
        """Call OpenAI API."""
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

            response = await client.chat.completions.create(
                model=model or "gpt-4o",
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
            )

            choice = response.choices[0] if response.choices else None

            return {
                "response": choice.message.content if choice else "",
                "model": response.model,
                "usage": {
                    "input_tokens": response.usage.prompt_tokens if response.usage else 0,
                    "output_tokens": response.usage.completion_tokens if response.usage else 0,
                },
            }

        except ImportError:
            raise RuntimeError("openai package not installed")
        except Exception as e:
            raise RuntimeError(f"OpenAI API error: {e}")
