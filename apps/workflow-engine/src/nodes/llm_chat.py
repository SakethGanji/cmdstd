"""LLM Chat node - single-turn LLM integration."""

from __future__ import annotations

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
                display_name="Model",
                name="model",
                type="options",
                default="gemini-2.0-flash",
                options=[
                    NodePropertyOption(name="Mock (Testing)", value="mock"),
                    NodePropertyOption(name="Gemini 2.0 Flash", value="gemini-2.0-flash"),
                    NodePropertyOption(name="Gemini 1.5 Flash", value="gemini-1.5-flash"),
                    NodePropertyOption(name="Gemini 1.5 Pro", value="gemini-1.5-pro"),
                    NodePropertyOption(name="GPT-4o", value="gpt-4o"),
                    NodePropertyOption(name="GPT-4o Mini", value="gpt-4o-mini"),
                    NodePropertyOption(name="Claude Sonnet", value="claude-sonnet-4-20250514"),
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
        system_prompt_template = self.get_parameter(node_definition, "systemPrompt", "You are a helpful assistant.")
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
            # Resolve expressions in both system prompt and user message
            system_prompt = expression_engine.resolve(system_prompt_template, expr_context)
            user_message = expression_engine.resolve(user_message_template, expr_context)

            if not user_message:
                raise ValueError("User message is required")

            # Use mock response for testing
            if model == "mock":
                result = self._mock_response(user_message)
            else:
                result = await self._call_llm(
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

    async def _call_llm(
        self,
        model: str,
        system_prompt: str,
        user_message: str,
        temperature: float,
        max_tokens: int,
    ) -> dict[str, Any]:
        """Call LLM via the unified provider."""
        from ..engine.llm_provider import get_llm_provider, LLMMessage

        provider = get_llm_provider()

        messages: list[LLMMessage] = []
        if system_prompt:
            messages.append(LLMMessage(role="system", content=system_prompt))
        messages.append(LLMMessage(role="user", content=user_message))

        response = await provider.chat(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        return {
            "response": response.content or "",
            "model": model,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
        }
