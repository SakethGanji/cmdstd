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
                default="mock",
                options=[
                    NodePropertyOption(name="Mock (Testing)", value="mock"),
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
                default="{{ $json.message }}",
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
        from ..engine.expression_engine import ExpressionEngine, expression_engine

        model = self.get_parameter(node_definition, "model", "mock")
        system_prompt = self.get_parameter(node_definition, "systemPrompt", "You are a helpful assistant.")
        user_message_template = self.get_parameter(node_definition, "userMessage", "{{ $json.message }}")
        temperature = self.get_parameter(node_definition, "temperature", 0.7)
        max_tokens = self.get_parameter(node_definition, "maxTokens", 1024)

        results: list[NodeData] = []

        for idx, item in enumerate(input_data if input_data else [NodeData(json={})]):
            # Resolve expression against current item's data
            expr_context = ExpressionEngine.create_context(
                input_data,
                context.node_states,
                context.execution_id,
                idx,
            )
            user_message = expression_engine.resolve(user_message_template, expr_context)

            if not user_message:
                raise ValueError("User message is required")

            # Use mock response for testing
            if model == "mock":
                result = self._mock_response(user_message)
            else:
                result = await self._call_gemini(
                    model=model,
                    system_prompt=system_prompt,
                    user_message=user_message,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            results.append(NodeData(json=result))

        return self.output(results)

    def _mock_response(self, user_message: str) -> dict[str, Any]:
        """Generate a mock response for testing."""
        lower_msg = user_message.lower().strip()

        # Number-based responses for testing dynamic behavior
        number_responses = {
            "1": "You entered 1! This is response ONE. 🥇",
            "2": "You entered 2! This is response TWO. 🥈",
            "3": "You entered 3! This is response THREE. 🥉",
            "4": "You entered 4! This is response FOUR. 🍀",
            "5": "You entered 5! This is response FIVE. ✋",
        }

        # Check for number input first
        if lower_msg in number_responses:
            response = number_responses[lower_msg]
            return {
                "response": response,
                "message": response,
                "model": "mock",
                "input": user_message,
                "usage": {"input_tokens": len(user_message.split()), "output_tokens": len(response.split())},
            }

        # Keyword-based responses
        keyword_responses = {
            "hello": "Hello! I'm a mock LLM assistant. Try entering numbers 1-5 for different responses!",
            "hi": "Hi there! I'm running in mock mode. Try: 1, 2, 3, 4, or 5 for dynamic responses!",
            "help": "Mock assistant here! Try these:\n• Enter 1-5 for numbered responses\n• 'hello' or 'hi' for greetings\n• 'joke' for a joke\n• 'weather' for weather\n• Anything else to see echo",
            "weather": "Mock weather report: Sunny with 72°F (22°C). Perfect coding weather! ☀️",
            "joke": "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
            "test": "Test successful! The workflow is working correctly. 🎉",
        }

        # Check for keyword matches
        for keyword, response in keyword_responses.items():
            if keyword in lower_msg:
                return {
                    "response": response,
                    "message": response,
                    "model": "mock",
                    "input": user_message,
                    "usage": {"input_tokens": len(user_message.split()), "output_tokens": len(response.split())},
                }

        # Echo response for anything else
        response = f"Echo: \"{user_message}\"\n\n(Mock mode - enter 1-5 or 'help' for more options)"
        return {
            "response": response,
            "message": response,
            "model": "mock",
            "input": user_message,
            "usage": {"input_tokens": len(user_message.split()), "output_tokens": len(response.split())},
        }

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
