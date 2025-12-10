"""AI Agent node - agentic loop with tool calling."""

from __future__ import annotations

import json
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


class AIAgentNode(BaseNode):
    """AI Agent node - agentic loop with tool calling capabilities."""

    node_description = NodeTypeDescription(
        name="AIAgent",
        display_name="AI Agent",
        description="Autonomous agent with tool calling capabilities",
        icon="fa:brain",
        group=["ai"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs=[
            NodeOutputDefinition(
                name="main",
                display_name="Result",
                schema={
                    "type": "object",
                    "properties": {
                        "response": {"type": "string", "description": "Final agent response"},
                        "toolCalls": {"type": "array", "description": "Tools called during execution"},
                        "iterations": {"type": "number", "description": "Number of agent iterations"},
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
            ),
            NodeProperty(
                display_name="System Prompt",
                name="systemPrompt",
                type="string",
                default="You are a helpful AI assistant with access to tools.",
                type_options={"rows": 3},
            ),
            NodeProperty(
                display_name="Task",
                name="task",
                type="string",
                default="",
                required=True,
                description="Task for the agent. Supports expressions.",
                type_options={"rows": 5},
            ),
            NodeProperty(
                display_name="Tools",
                name="tools",
                type="collection",
                default=[],
                type_options={"multipleValues": True},
                properties=[
                    NodeProperty(
                        display_name="Tool Name",
                        name="name",
                        type="string",
                        default="",
                    ),
                    NodeProperty(
                        display_name="Description",
                        name="description",
                        type="string",
                        default="",
                    ),
                    NodeProperty(
                        display_name="Parameters (JSON Schema)",
                        name="parameters",
                        type="json",
                        default="{}",
                    ),
                ],
            ),
            NodeProperty(
                display_name="Max Iterations",
                name="maxIterations",
                type="number",
                default=10,
                description="Maximum number of agent iterations",
            ),
            NodeProperty(
                display_name="Temperature",
                name="temperature",
                type="number",
                default=0.7,
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "AIAgent"

    @property
    def description(self) -> str:
        return "Autonomous agent with tool calling capabilities"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        from ..engine.types import NodeData

        provider = self.get_parameter(node_definition, "provider", "anthropic")
        model = self.get_parameter(node_definition, "model", "claude-sonnet-4-20250514")
        system_prompt = self.get_parameter(node_definition, "systemPrompt", "")
        task = self.get_parameter(node_definition, "task", "")
        tools_config = self.get_parameter(node_definition, "tools", [])
        max_iterations = self.get_parameter(node_definition, "maxIterations", 10)
        temperature = self.get_parameter(node_definition, "temperature", 0.7)

        if not task:
            raise ValueError("Task is required")

        # Build tools list
        tools = self._build_tools(tools_config)

        results: list[NodeData] = []

        for item in input_data if input_data else [NodeData(json={})]:
            # Add input context to task
            context_str = json.dumps(item.json, indent=2) if item.json else ""
            full_task = f"{task}\n\nInput data:\n{context_str}" if context_str else task

            if provider == "anthropic":
                result = await self._run_anthropic_agent(
                    model=model,
                    system_prompt=system_prompt,
                    task=full_task,
                    tools=tools,
                    max_iterations=max_iterations,
                    temperature=temperature,
                )
            else:
                result = await self._run_openai_agent(
                    model=model,
                    system_prompt=system_prompt,
                    task=full_task,
                    tools=tools,
                    max_iterations=max_iterations,
                    temperature=temperature,
                )

            results.append(NodeData(json=result))

        return self.output(results)

    def _build_tools(self, tools_config: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Build tools array from config."""
        tools = []

        for tool in tools_config:
            if not tool.get("name"):
                continue

            params = tool.get("parameters", {})
            if isinstance(params, str):
                try:
                    params = json.loads(params)
                except json.JSONDecodeError:
                    params = {}

            tools.append({
                "name": tool["name"],
                "description": tool.get("description", ""),
                "input_schema": params,
            })

        # Add built-in tools if no custom tools specified
        if not tools:
            tools = [
                {
                    "name": "search",
                    "description": "Search for information",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "Search query"},
                        },
                        "required": ["query"],
                    },
                },
                {
                    "name": "calculate",
                    "description": "Perform a calculation",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "expression": {"type": "string", "description": "Math expression"},
                        },
                        "required": ["expression"],
                    },
                },
            ]

        return tools

    async def _run_anthropic_agent(
        self,
        model: str,
        system_prompt: str,
        task: str,
        tools: list[dict[str, Any]],
        max_iterations: int,
        temperature: float,
    ) -> dict[str, Any]:
        """Run an agentic loop with Anthropic."""
        try:
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

            messages: list[dict[str, Any]] = [{"role": "user", "content": task}]
            tool_calls: list[dict[str, Any]] = []
            iterations = 0

            # Convert tools to Anthropic format
            anthropic_tools = [
                {
                    "name": t["name"],
                    "description": t["description"],
                    "input_schema": t["input_schema"],
                }
                for t in tools
            ]

            while iterations < max_iterations:
                iterations += 1

                response = await client.messages.create(
                    model=model,
                    max_tokens=4096,
                    temperature=temperature,
                    system=system_prompt,
                    tools=anthropic_tools,
                    messages=messages,
                )

                # Check if we're done
                if response.stop_reason == "end_turn":
                    final_text = ""
                    for block in response.content:
                        if hasattr(block, "text"):
                            final_text += block.text
                    return {
                        "response": final_text,
                        "toolCalls": tool_calls,
                        "iterations": iterations,
                    }

                # Process tool use
                if response.stop_reason == "tool_use":
                    assistant_content = response.content
                    messages.append({"role": "assistant", "content": assistant_content})

                    tool_results = []
                    for block in assistant_content:
                        if block.type == "tool_use":
                            tool_call = {
                                "tool": block.name,
                                "input": block.input,
                                "id": block.id,
                            }
                            tool_calls.append(tool_call)

                            # Execute tool (mock for now)
                            result = await self._execute_tool(block.name, block.input)
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": json.dumps(result),
                            })

                    messages.append({"role": "user", "content": tool_results})
                else:
                    # Unknown stop reason, return what we have
                    break

            return {
                "response": "Agent reached maximum iterations",
                "toolCalls": tool_calls,
                "iterations": iterations,
            }

        except ImportError:
            raise RuntimeError("anthropic package not installed")
        except Exception as e:
            raise RuntimeError(f"Anthropic agent error: {e}")

    async def _run_openai_agent(
        self,
        model: str,
        system_prompt: str,
        task: str,
        tools: list[dict[str, Any]],
        max_iterations: int,
        temperature: float,
    ) -> dict[str, Any]:
        """Run an agentic loop with OpenAI."""
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

            messages: list[dict[str, Any]] = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": task},
            ]
            tool_calls_list: list[dict[str, Any]] = []
            iterations = 0

            # Convert tools to OpenAI format
            openai_tools = [
                {
                    "type": "function",
                    "function": {
                        "name": t["name"],
                        "description": t["description"],
                        "parameters": t["input_schema"],
                    },
                }
                for t in tools
            ]

            while iterations < max_iterations:
                iterations += 1

                response = await client.chat.completions.create(
                    model=model or "gpt-4o",
                    max_tokens=4096,
                    temperature=temperature,
                    messages=messages,
                    tools=openai_tools if openai_tools else None,
                )

                choice = response.choices[0]

                # Check if we're done
                if choice.finish_reason == "stop":
                    return {
                        "response": choice.message.content or "",
                        "toolCalls": tool_calls_list,
                        "iterations": iterations,
                    }

                # Process tool calls
                if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
                    messages.append(choice.message.model_dump())

                    for tool_call in choice.message.tool_calls:
                        tool_input = json.loads(tool_call.function.arguments)
                        tool_calls_list.append({
                            "tool": tool_call.function.name,
                            "input": tool_input,
                            "id": tool_call.id,
                        })

                        # Execute tool (mock for now)
                        result = await self._execute_tool(tool_call.function.name, tool_input)
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": json.dumps(result),
                        })
                else:
                    break

            return {
                "response": "Agent reached maximum iterations",
                "toolCalls": tool_calls_list,
                "iterations": iterations,
            }

        except ImportError:
            raise RuntimeError("openai package not installed")
        except Exception as e:
            raise RuntimeError(f"OpenAI agent error: {e}")

    async def _execute_tool(self, name: str, input_data: dict[str, Any]) -> Any:
        """Execute a tool (mock implementation)."""
        # This is a placeholder - in a real implementation,
        # tools would be dynamically registered and executed
        if name == "search":
            return {"results": f"Search results for: {input_data.get('query', '')}"}
        elif name == "calculate":
            try:
                expr = input_data.get("expression", "0")
                # Safe eval for simple math
                result = eval(expr, {"__builtins__": {}}, {})
                return {"result": result}
            except Exception:
                return {"error": "Invalid expression"}
        else:
            return {"message": f"Tool '{name}' executed with input: {input_data}"}
