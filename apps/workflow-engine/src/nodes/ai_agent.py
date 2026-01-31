"""AI Agent node - agentic loop with tool calling."""

from __future__ import annotations

import json
from typing import Any, TYPE_CHECKING

from .base import (
    BaseNode,
    NodeTypeDescription,
    NodeInputDefinition,
    NodeOutputDefinition,
    NodeProperty,
    NodePropertyOption,
)
from ..engine.types import SubnodeSlotDefinition

if TYPE_CHECKING:
    from ..engine.types import (
        ExecutionContext,
        NodeData,
        NodeDefinition,
        NodeExecutionResult,
        SubnodeContext,
    )


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
        subnode_slots=[
            SubnodeSlotDefinition(
                name="chatModel",
                display_name="Model",
                slot_type="model",
                required=False,
                multiple=False,
            ),
            SubnodeSlotDefinition(
                name="memory",
                display_name="Memory",
                slot_type="memory",
                required=False,
                multiple=False,
            ),
            SubnodeSlotDefinition(
                name="tools",
                display_name="Tools",
                slot_type="tool",
                required=False,
                multiple=True,
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
        subnode_context: SubnodeContext | None = None,
    ) -> NodeExecutionResult:
        from ..engine.types import NodeData

        # Get parameters with defaults
        model = self.get_parameter(node_definition, "model", "gemini-2.0-flash")
        system_prompt = self.get_parameter(node_definition, "systemPrompt", "")
        task = self.get_parameter(node_definition, "task", "")
        tools_config = self.get_parameter(node_definition, "tools", [])
        max_iterations = self.get_parameter(node_definition, "maxIterations", 10)
        temperature = self.get_parameter(node_definition, "temperature", 0.7)

        # Override with model subnode config if connected
        model_config = self._get_model_config(subnode_context)
        if model_config:
            model = model_config.get("model", model)
            temperature = model_config.get("temperature", temperature)

        # Get memory functions if connected
        memory_config = self._get_memory_config(subnode_context)

        if not task:
            raise ValueError("Task is required")

        # Build tools from connected subnodes first, then from config
        tools, tool_executors = self._build_tools_from_subnodes(subnode_context)

        # Add tools from parameter config if no subnodes connected
        if not tools:
            tools = self._build_tools(tools_config)

        results: list[NodeData] = []

        for item in input_data if input_data else [NodeData(json={})]:
            # Build task with context
            context_str = json.dumps(item.json, indent=2) if item.json else ""

            # Inject chat history from memory if available
            chat_history = ""
            if memory_config and "getHistoryText" in memory_config:
                chat_history = memory_config["getHistoryText"]()

            # Build full task with history and input
            full_task = task
            if chat_history:
                full_task = f"Previous conversation:\n{chat_history}\n\nCurrent request: {task}"
            if context_str:
                full_task = f"{full_task}\n\nInput data:\n{context_str}"

            result = await self._run_agent_loop(
                model=model,
                system_prompt=system_prompt,
                task=full_task,
                tools=tools,
                tool_executors=tool_executors,
                max_iterations=max_iterations,
                temperature=temperature,
            )

            # Save to memory if connected
            if memory_config and "addMessage" in memory_config:
                memory_config["addMessage"]("user", task)
                if result.get("response"):
                    memory_config["addMessage"]("assistant", result["response"])

            results.append(NodeData(json=result))

        return self.output(results)

    def _get_model_config(self, subnode_context: SubnodeContext | None) -> dict[str, Any] | None:
        """Get model configuration from connected model subnode."""
        if not subnode_context or not subnode_context.models:
            return None
        # Use first connected model
        return subnode_context.models[0].config

    def _get_memory_config(self, subnode_context: SubnodeContext | None) -> dict[str, Any] | None:
        """Get memory configuration from connected memory subnode."""
        if not subnode_context or not subnode_context.memory:
            return None
        # Use first connected memory
        return subnode_context.memory[0].config

    def _build_tools_from_subnodes(
        self, subnode_context: SubnodeContext | None
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """Build tools from connected tool subnodes."""
        tools = []
        tool_executors: dict[str, Any] = {}

        if not subnode_context or not subnode_context.tools:
            return tools, tool_executors

        for resolved_tool in subnode_context.tools:
            config = resolved_tool.config
            if not config.get("name"):
                continue

            tools.append({
                "name": config["name"],
                "description": config.get("description", ""),
                "input_schema": config.get("input_schema", {}),
            })

            # Store executor if provided
            if "execute" in config:
                tool_executors[config["name"]] = config["execute"]

        return tools, tool_executors

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

    async def _run_agent_loop(
        self,
        model: str,
        system_prompt: str,
        task: str,
        tools: list[dict[str, Any]],
        tool_executors: dict[str, Any],
        max_iterations: int,
        temperature: float,
    ) -> dict[str, Any]:
        """Run an agentic tool-calling loop via the unified LLM provider."""
        from ..engine.llm_provider import get_llm_provider, LLMMessage, LLMTool

        provider = get_llm_provider()

        # Convert tools to LLMTool format
        llm_tools: list[LLMTool] = []
        for t in tools:
            llm_tools.append(LLMTool(
                name=t["name"],
                description=t["description"],
                parameters=t.get("input_schema", {}),
            ))

        # Build initial messages
        messages: list[LLMMessage] = []
        if system_prompt:
            messages.append(LLMMessage(role="system", content=system_prompt))
        messages.append(LLMMessage(role="user", content=task))

        tool_calls_list: list[dict[str, Any]] = []
        iterations = 0

        while iterations < max_iterations:
            iterations += 1

            response = await provider.chat(
                model=model,
                messages=messages,
                tools=llm_tools if llm_tools else None,
                temperature=temperature,
                max_tokens=4096,
            )

            if response.tool_calls:
                # Append assistant message with tool calls
                messages.append(LLMMessage(
                    role="assistant",
                    content=response.content,
                    tool_calls=response.tool_calls,
                ))

                # Execute each tool and append results
                for tc in response.tool_calls:
                    tool_calls_list.append({
                        "tool": tc.name,
                        "input": tc.arguments,
                        "id": tc.id,
                    })

                    tool_result = self._execute_tool(tc.name, tc.arguments, tool_executors)
                    result_str = json.dumps(tool_result) if not isinstance(tool_result, str) else tool_result

                    messages.append(LLMMessage(
                        role="tool",
                        content=result_str,
                        tool_call_id=tc.id,
                    ))

                # Continue loop for model to process tool results
                continue
            else:
                # No tool calls — final text response
                return {
                    "response": response.content or "",
                    "toolCalls": tool_calls_list,
                    "iterations": iterations,
                }

        return {
            "response": "Agent reached maximum iterations",
            "toolCalls": tool_calls_list,
            "iterations": iterations,
        }

    def _execute_tool(
        self, name: str, input_data: dict[str, Any], tool_executors: dict[str, Any]
    ) -> Any:
        """Execute a tool using custom executor or built-in fallback."""
        # Try custom executor first (from connected subnodes)
        if name in tool_executors:
            executor = tool_executors[name]
            try:
                return executor(input_data)
            except Exception as e:
                return {"error": str(e)}

        # Built-in fallback tools
        if name == "search":
            return {"results": f"Search results for: {input_data.get('query', '')}"}
        elif name == "calculate":
            try:
                expr = input_data.get("expression", "0")
                allowed = {"abs": abs, "round": round, "min": min, "max": max, "pow": pow}
                result = eval(expr, {"__builtins__": {}}, allowed)
                return {"result": result}
            except Exception:
                return {"error": "Invalid expression"}
        else:
            return {"message": f"Tool '{name}' executed with input: {input_data}"}
