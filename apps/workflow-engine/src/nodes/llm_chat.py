"""LLM Chat node - single-turn LLM integration."""

from __future__ import annotations

import os
from typing import Any, TYPE_CHECKING

import httpx

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
                display_name="Model",
                name="model",
                type="options",
                default="gemini-2.5-flash",
                options=[
                    NodePropertyOption(name="Gemini 2.5 Flash", value="gemini-2.5-flash"),
                    NodePropertyOption(name="Gemini 2.5 Pro", value="gemini-2.5-pro"),
                    NodePropertyOption(name="Gemini 2.0 Flash", value="gemini-2.0-flash"),
                    NodePropertyOption(name="Gemini 1.5 Pro", value="gemini-1.5-pro"),
                    NodePropertyOption(name="Gemini 1.5 Flash", value="gemini-1.5-flash"),
                ],
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

        model = self.get_parameter(node_definition, "model", "gemini-2.5-flash")
        system_prompt = self.get_parameter(node_definition, "systemPrompt", "You are a helpful assistant.")
        user_message = self.get_parameter(node_definition, "userMessage", "")
        temperature = self.get_parameter(node_definition, "temperature", 0.7)
        max_tokens = self.get_parameter(node_definition, "maxTokens", 1024)

        if not user_message:
            raise ValueError("User message is required")

        results: list[NodeData] = []

        for _item in input_data if input_data else [NodeData(json={})]:
            result = await self._call_gemini(
                model=model,
                system_prompt=system_prompt,
                user_message=user_message,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            results.append(NodeData(json=result))

        return self.output(results)

    async def _call_gemini(
        self,
        model: str,
        system_prompt: str,
        user_message: str,
        temperature: float,
        max_tokens: int,
    ) -> dict[str, Any]:
        """Call Google Gemini API."""
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY environment variable not set")

        base_url = "https://generativelanguage.googleapis.com/v1beta"

        # Build request body
        request_body: dict[str, Any] = {
            "contents": [
                {"role": "user", "parts": [{"text": user_message}]}
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }

        if system_prompt:
            request_body["systemInstruction"] = {
                "parts": [{"text": system_prompt}]
            }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/models/{model}:generateContent",
                params={"key": api_key},
                json=request_body,
                timeout=120.0,
            )

            if response.status_code != 200:
                error_detail = response.text
                raise RuntimeError(f"Gemini API error ({response.status_code}): {error_detail}")

            result = response.json()

            # Check for errors in response
            if "error" in result:
                raise RuntimeError(f"Gemini API error: {result['error']}")

            # Extract response text
            candidates = result.get("candidates", [])
            if not candidates:
                return {
                    "response": "",
                    "model": model,
                    "usage": {"input_tokens": 0, "output_tokens": 0},
                }

            candidate = candidates[0]
            content = candidate.get("content", {})
            parts = content.get("parts", [])
            text_parts = [p.get("text", "") for p in parts if "text" in p]
            response_text = "".join(text_parts)

            # Extract usage metadata
            usage_metadata = result.get("usageMetadata", {})

            return {
                "response": response_text,
                "model": model,
                "usage": {
                    "input_tokens": usage_metadata.get("promptTokenCount", 0),
                    "output_tokens": usage_metadata.get("candidatesTokenCount", 0),
                },
            }
