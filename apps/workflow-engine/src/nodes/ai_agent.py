"""AI Agent node - agentic loop with tool calling."""

from __future__ import annotations

import json
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

        model = self.get_parameter(node_definition, "model", "gemini-2.5-flash")
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

            result = await self._run_gemini_agent(
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

    async def _run_gemini_agent(
        self,
        model: str,
        system_prompt: str,
        task: str,
        tools: list[dict[str, Any]],
        max_iterations: int,
        temperature: float,
    ) -> dict[str, Any]:
        """Run an agentic loop with Google Gemini."""
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY environment variable not set")

        base_url = "https://generativelanguage.googleapis.com/v1beta"

        # Build contents array for conversation
        contents: list[dict[str, Any]] = []
        if task:
            contents.append({"role": "user", "parts": [{"text": task}]})

        tool_calls_list: list[dict[str, Any]] = []
        iterations = 0

        # Convert tools to Gemini format
        gemini_tools = None
        if tools:
            function_declarations = []
            for t in tools:
                func_decl: dict[str, Any] = {
                    "name": t["name"],
                    "description": t["description"],
                }
                # Only add parameters if they have properties
                if t.get("input_schema") and t["input_schema"].get("properties"):
                    func_decl["parameters"] = t["input_schema"]
                function_declarations.append(func_decl)
            gemini_tools = [{"functionDeclarations": function_declarations}]

        async with httpx.AsyncClient() as client:
            while iterations < max_iterations:
                iterations += 1

                # Build request body
                request_body: dict[str, Any] = {
                    "contents": contents,
                    "generationConfig": {
                        "temperature": temperature,
                        "maxOutputTokens": 4096,
                    },
                }

                if system_prompt:
                    request_body["systemInstruction"] = {
                        "parts": [{"text": system_prompt}]
                    }

                if gemini_tools:
                    request_body["tools"] = gemini_tools

                # Make API request
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

                # Get the candidate response
                candidates = result.get("candidates", [])
                if not candidates:
                    return {
                        "response": "No response from model",
                        "toolCalls": tool_calls_list,
                        "iterations": iterations,
                    }

                candidate = candidates[0]
                content = candidate.get("content", {})
                parts = content.get("parts", [])
                finish_reason = candidate.get("finishReason", "")

                # Check for function calls
                function_calls = [p for p in parts if "functionCall" in p]

                if function_calls:
                    # Add assistant response to conversation
                    contents.append({"role": "model", "parts": parts})

                    # Process each function call
                    function_responses = []
                    for part in function_calls:
                        fc = part["functionCall"]
                        tool_name = fc["name"]
                        tool_args = fc.get("args", {})

                        tool_calls_list.append({
                            "tool": tool_name,
                            "input": tool_args,
                            "id": f"{tool_name}_{iterations}",
                        })

                        # Execute tool
                        tool_result = await self._execute_tool(tool_name, tool_args)
                        function_responses.append({
                            "functionResponse": {
                                "name": tool_name,
                                "response": {"result": tool_result},
                            }
                        })

                    # Add function responses to conversation
                    contents.append({"role": "user", "parts": function_responses})
                else:
                    # No function calls - extract text response
                    text_parts = [p.get("text", "") for p in parts if "text" in p]
                    final_text = "".join(text_parts)

                    return {
                        "response": final_text,
                        "toolCalls": tool_calls_list,
                        "iterations": iterations,
                    }

                # Check if we should stop
                if finish_reason == "STOP":
                    text_parts = [p.get("text", "") for p in parts if "text" in p]
                    return {
                        "response": "".join(text_parts),
                        "toolCalls": tool_calls_list,
                        "iterations": iterations,
                    }

        return {
            "response": "Agent reached maximum iterations",
            "toolCalls": tool_calls_list,
            "iterations": iterations,
        }

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
