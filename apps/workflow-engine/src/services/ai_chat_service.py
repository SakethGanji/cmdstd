"""AI Chat service — ADK-powered workflow assistant with real tool use."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator

from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from ..core.config import settings
from ..engine.expression_engine import ExpressionEngine, ExpressionContext
from ..engine.node_registry import NodeRegistryClass
from ..engine.types import (
    Connection,
    NodeData,
    NodeDefinition,
    Workflow,
)
from ..engine.workflow_runner import WorkflowRunner
from ..schemas.ai_chat import AIChatRequest

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model configuration
# ---------------------------------------------------------------------------
AGENT_MODEL = "gemini-2.0-flash"

_api_key = getattr(settings, "gemini_api_key", None) or os.environ.get("GOOGLE_API_KEY", "")
if _api_key:
    os.environ["GOOGLE_API_KEY"] = _api_key


# ---------------------------------------------------------------------------
# ShadowWorkflow — mutable in-memory workflow manipulated by tool closures
# ---------------------------------------------------------------------------


@dataclass
class ShadowNode:
    """Lightweight mutable node representation."""

    name: str
    type: str
    parameters: dict[str, Any] = field(default_factory=dict)


class ShadowWorkflow:
    """Server-side mutable workflow that tool closures read/write."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.nodes: dict[str, ShadowNode] = {}
        self.connections: list[dict[str, str]] = []
        self._operation_log: list[dict[str, Any]] = []

    # -- factory ----------------------------------------------------------

    @classmethod
    def from_workflow_context(cls, ctx: Any | None) -> "ShadowWorkflow":
        """Build from the request's WorkflowContext (or empty)."""
        if ctx is None:
            return cls("Untitled")
        sw = cls(ctx.name or "Untitled")
        for n in ctx.nodes or []:
            name = n.get("name", "")
            sw.nodes[name] = ShadowNode(
                name=name,
                type=n.get("type", ""),
                parameters=n.get("parameters") or {},
            )
        for c in ctx.connections or []:
            sw.connections.append({
                "source_node": c.get("source_node", ""),
                "target_node": c.get("target_node", ""),
                "source_output": c.get("source_output", "main"),
                "target_input": c.get("target_input", "main"),
            })
        return sw

    # -- mutations --------------------------------------------------------

    def add_node(
        self,
        name: str,
        node_type: str,
        parameters: dict[str, Any] | None = None,
    ) -> ShadowNode:
        node = ShadowNode(name=name, type=node_type, parameters=parameters or {})
        self.nodes[name] = node
        self._operation_log.append({
            "op": "addNode",
            "type": node_type,
            "name": name,
            "parameters": node.parameters,
        })
        return node

    def update_node(self, name: str, parameters: dict[str, Any]) -> ShadowNode:
        node = self.nodes[name]
        node.parameters.update(parameters)
        self._operation_log.append({
            "op": "updateNode",
            "name": name,
            "parameters": node.parameters,
        })
        return node

    def remove_node(self, name: str) -> None:
        del self.nodes[name]
        self.connections = [
            c
            for c in self.connections
            if c["source_node"] != name and c["target_node"] != name
        ]
        self._operation_log.append({"op": "removeNode", "name": name})

    def add_connection(
        self,
        source_node: str,
        target_node: str,
        source_output: str = "main",
        target_input: str = "main",
    ) -> None:
        conn = {
            "source_node": source_node,
            "target_node": target_node,
            "source_output": source_output,
            "target_input": target_input,
        }
        self.connections.append(conn)
        self._operation_log.append({"op": "addConnection", **conn})

    def remove_connection(self, source_node: str, target_node: str) -> None:
        self.connections = [
            c
            for c in self.connections
            if not (c["source_node"] == source_node and c["target_node"] == target_node)
        ]
        self._operation_log.append({
            "op": "removeConnection",
            "source_node": source_node,
            "target_node": target_node,
        })

    def replace_all(
        self,
        name: str,
        nodes: list[dict[str, Any]],
        connections: list[dict[str, Any]],
    ) -> None:
        self.name = name
        self.nodes.clear()
        self.connections.clear()
        for n in nodes:
            node_name = n.get("name", "")
            self.nodes[node_name] = ShadowNode(
                name=node_name,
                type=n.get("type", ""),
                parameters=n.get("parameters") or {},
            )
        for c in connections:
            self.connections.append({
                "source_node": c.get("source_node", ""),
                "target_node": c.get("target_node", ""),
                "source_output": c.get("source_output", "main"),
                "target_input": c.get("target_input", "main"),
            })
        # Log as full-workflow replacement (handled specially in get_operation_log)
        self._operation_log.clear()
        self._operation_log.append({
            "op": "replaceAll",
            "name": name,
            "nodes": nodes,
            "connections": self.connections[:],
        })

    # -- queries ----------------------------------------------------------

    def get_operation_log(self) -> list[dict[str, Any]]:
        return list(self._operation_log)

    def get_summary(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "node_count": len(self.nodes),
            "nodes": [
                {"name": n.name, "type": n.type} for n in self.nodes.values()
            ],
            "connections": [
                f"{c['source_node']}→{c['target_node']}" for c in self.connections
            ],
        }

    def to_workflow(self) -> Workflow:
        """Convert to engine Workflow dataclass for WorkflowRunner."""
        node_defs = [
            NodeDefinition(
                name=n.name,
                type=n.type,
                parameters=dict(n.parameters),
            )
            for n in self.nodes.values()
        ]
        conn_defs = [
            Connection(
                source_node=c["source_node"],
                target_node=c["target_node"],
                source_output=c["source_output"],
                target_input=c["target_input"],
            )
            for c in self.connections
        ]
        return Workflow(name=self.name, nodes=node_defs, connections=conn_defs)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class AIChatService:
    """ADK-powered workflow assistant with real tools."""

    APP_NAME = "workflow-assistant"
    _MAX_HISTORY_MESSAGES = 20
    _MAX_MESSAGE_CHARS = 500

    def __init__(self, node_registry: NodeRegistryClass) -> None:
        self._registry = node_registry
        self._node_catalog: str | None = None
        self._session_service = InMemorySessionService()

    # ------------------------------------------------------------------
    # Node catalog (built once, cached)
    # ------------------------------------------------------------------

    def _build_node_catalog(self) -> str:
        if self._node_catalog is not None:
            return self._node_catalog

        infos = self._registry.get_node_info_full()

        groups: dict[str, list[str]] = {}
        for info in infos:
            if info.is_subnode:
                continue
            group = (info.group or ["other"])[0]
            entry_parts = [f"- **{info.type}**: {info.description}"]

            if info.properties:
                param_strs = []
                for p in info.properties[:6]:
                    param_strs.append(f"{p['name']}({p['type']})")
                if param_strs:
                    entry_parts.append(f"  Params: {', '.join(param_strs)}")

            if info.inputs:
                in_names = [i["name"] for i in info.inputs]
                entry_parts.append(f"  In: {', '.join(in_names)}")
            if info.outputs:
                out_names = [o["name"] for o in info.outputs]
                entry_parts.append(f"  Out: {', '.join(out_names)}")

            groups.setdefault(group, []).append("\n".join(entry_parts))

        lines: list[str] = []
        for group_name, entries in groups.items():
            lines.append(f"\n### {group_name.title()}")
            lines.extend(entries)

        self._node_catalog = "\n".join(lines)
        return self._node_catalog

    # ------------------------------------------------------------------
    # Closure-based tool builder
    # ------------------------------------------------------------------

    def _build_tools(self, shadow: ShadowWorkflow) -> list:
        """Return tool functions as closures bound to *shadow* and *self._registry*."""
        registry = self._registry

        # ---- Read tools ------------------------------------------------

        def inspect_workflow() -> dict:
            """Inspect the current workflow state. Returns name, node count, node list, and connections.
            Always call this first to understand what's on the canvas before making changes."""
            try:
                return shadow.get_summary()
            except Exception as e:
                return {"error": str(e)}

        def inspect_node(name: str) -> dict:
            """Inspect a specific node's full details including all parameters.

            Args:
                name: The unique name of the node to inspect.
            """
            try:
                node = shadow.nodes.get(name)
                if node is None:
                    return {"error": f"Node '{name}' not found"}
                return {
                    "name": node.name,
                    "type": node.type,
                    "parameters": node.parameters,
                }
            except Exception as e:
                return {"error": str(e)}

        def get_node_schema(node_type: str) -> dict:
            """Get the full schema for a node type including all properties, inputs, outputs, and defaults.
            Use this to understand what parameters a node type accepts before adding or updating nodes.

            Args:
                node_type: The type identifier (e.g. 'HttpRequest', 'If', 'Code').
            """
            try:
                info = registry.get_node_type_info(node_type)
                if info is None:
                    return {"error": f"Unknown node type '{node_type}'"}
                result: dict[str, Any] = {
                    "type": info.type,
                    "display_name": info.display_name,
                    "description": info.description,
                    "group": info.group,
                }
                if info.properties:
                    result["properties"] = info.properties
                if info.inputs:
                    result["inputs"] = info.inputs
                if info.outputs:
                    result["outputs"] = info.outputs
                return result
            except Exception as e:
                return {"error": str(e)}

        def search_node_types(query: str) -> dict:
            """Search available node types by keyword. Returns matching types with descriptions.

            Args:
                query: Keyword to search for (e.g. 'http', 'filter', 'ai', 'loop').
            """
            try:
                query_lower = query.lower()
                infos = registry.get_node_info_full()
                matches = []
                for info in infos:
                    if info.is_subnode:
                        continue
                    searchable = f"{info.type} {info.display_name} {info.description}".lower()
                    if query_lower in searchable:
                        matches.append({
                            "type": info.type,
                            "description": info.description,
                            "group": info.group,
                        })
                return {"results": matches, "count": len(matches)}
            except Exception as e:
                return {"error": str(e)}

        # ---- Write tools -----------------------------------------------

        def add_node(
            type: str,
            name: str,
            parameters: dict | None = None,
            connect_after: str | None = None,
        ) -> dict:
            """Add a new node to the workflow.

            Args:
                type: The node type (e.g. 'HttpRequest', 'If', 'Code', 'Set', 'LLMChat').
                name: Unique name for the node. Use the type as base, append a number
                      if duplicated (e.g. HttpRequest, HttpRequest1).
                parameters: Configuration parameters for the node.
                connect_after: Name of an existing node to connect this node after
                               (source_output='main', target_input='main').
            """
            try:
                if not registry.has(type):
                    return {"error": f"Unknown node type '{type}'"}
                if name in shadow.nodes:
                    return {"error": f"Node '{name}' already exists"}
                shadow.add_node(name, type, parameters)
                if connect_after:
                    if connect_after not in shadow.nodes:
                        return {
                            "status": "partial",
                            "message": f"Added node '{name}' but connect_after node '{connect_after}' not found",
                        }
                    shadow.add_connection(connect_after, name)
                return {"status": "success", "message": f"Added node '{name}' of type '{type}'"}
            except Exception as e:
                return {"error": str(e)}

        def update_node(name: str, parameters: dict) -> dict:
            """Update parameters of an existing workflow node.

            Args:
                name: The unique name of the node to update.
                parameters: New parameter values to merge into the node's config.
            """
            try:
                if name not in shadow.nodes:
                    return {"error": f"Node '{name}' not found"}
                node = shadow.update_node(name, parameters)
                return {
                    "status": "success",
                    "message": f"Updated node '{name}'",
                    "parameters": node.parameters,
                }
            except Exception as e:
                return {"error": str(e)}

        def remove_node(name: str) -> dict:
            """Remove a node and all its connections from the workflow.

            Args:
                name: The unique name of the node to remove.
            """
            try:
                if name not in shadow.nodes:
                    return {"error": f"Node '{name}' not found"}
                shadow.remove_node(name)
                return {"status": "success", "message": f"Removed node '{name}'"}
            except Exception as e:
                return {"error": str(e)}

        def add_connection(
            source_node: str,
            target_node: str,
            source_output: str = "main",
            target_input: str = "main",
        ) -> dict:
            """Connect two nodes in the workflow.

            Args:
                source_node: Name of the source node.
                target_node: Name of the target node.
                source_output: Output handle name on source (default 'main').
                target_input: Input handle name on target (default 'main').
            """
            try:
                if source_node not in shadow.nodes:
                    return {"error": f"Source node '{source_node}' not found"}
                if target_node not in shadow.nodes:
                    return {"error": f"Target node '{target_node}' not found"}
                shadow.add_connection(source_node, target_node, source_output, target_input)
                return {
                    "status": "success",
                    "message": f"Connected '{source_node}' -> '{target_node}'",
                }
            except Exception as e:
                return {"error": str(e)}

        def remove_connection(source_node: str, target_node: str) -> dict:
            """Remove a connection between two nodes.

            Args:
                source_node: Name of the source node.
                target_node: Name of the target node.
            """
            try:
                shadow.remove_connection(source_node, target_node)
                return {
                    "status": "success",
                    "message": f"Disconnected '{source_node}' -> '{target_node}'",
                }
            except Exception as e:
                return {"error": str(e)}

        def generate_full_workflow(
            name: str,
            nodes: list[dict],
            connections: list[dict],
        ) -> dict:
            """Generate a complete new workflow, replacing whatever is currently on the canvas.
            Use this when the user asks to create a brand-new workflow from scratch.
            Always include a Start node as the first entry.

            Args:
                name: Name for the workflow.
                nodes: List of node objects. Each must have keys 'name' (str), 'type' (str),
                       and 'parameters' (dict). Always include a Start node as the first entry.
                connections: List of connection objects. Each must have keys 'source_node' and
                             'target_node', and optionally 'source_output' and 'target_input'
                             (both default to 'main').
            """
            try:
                # Validate node types
                for n in nodes:
                    ntype = n.get("type", "")
                    if ntype and not registry.has(ntype):
                        return {"error": f"Unknown node type '{ntype}'"}
                shadow.replace_all(name, nodes, connections)
                return {
                    "status": "success",
                    "message": f"Generated workflow '{name}' with {len(nodes)} nodes",
                }
            except Exception as e:
                return {"error": str(e)}

        # ---- Execute / Validate tools ----------------------------------

        async def run_workflow(input_data: dict | None = None) -> dict:
            """Execute the current workflow and return results. Use this to test the workflow.

            Args:
                input_data: Optional input data for the start node (dict). Defaults to empty.
            """
            try:
                wf = shadow.to_workflow()
                # Find start node
                start_name = None
                for n in wf.nodes:
                    if n.type == "Start":
                        start_name = n.name
                        break
                if start_name is None:
                    return {"error": "No Start node found in workflow"}

                wf_runner = WorkflowRunner()
                initial = [NodeData(json=input_data or {})]

                # Run with 30s timeout
                ctx = await asyncio.wait_for(
                    wf_runner.run(wf, start_name, initial_data=initial),
                    timeout=30,
                )

                # Collect outputs
                node_outputs = {}
                for node_name, data_list in ctx.node_states.items():
                    node_outputs[node_name] = [d.json for d in data_list]

                errors = [
                    {"node": e.node_name, "error": e.error}
                    for e in ctx.errors
                ]

                return {
                    "status": "error" if errors else "success",
                    "node_outputs": node_outputs,
                    "errors": errors,
                }
            except asyncio.TimeoutError:
                return {"error": "Workflow execution timed out (30s limit)"}
            except Exception as e:
                return {"error": f"Execution failed: {e}"}

        def validate_workflow() -> dict:
            """Validate the current workflow for correctness. Checks node types exist,
            connections reference valid nodes, no duplicate names, and has a Start node.
            Call this after making changes to catch issues early."""
            try:
                issues: list[str] = []

                # Check for Start node
                has_start = any(n.type == "Start" for n in shadow.nodes.values())
                if not has_start:
                    issues.append("Workflow has no Start node")

                # Check node types exist in registry
                for node in shadow.nodes.values():
                    if not registry.has(node.type):
                        issues.append(f"Node '{node.name}' has unknown type '{node.type}'")

                # Check connections reference existing nodes
                for c in shadow.connections:
                    if c["source_node"] not in shadow.nodes:
                        issues.append(
                            f"Connection references missing source node '{c['source_node']}'"
                        )
                    if c["target_node"] not in shadow.nodes:
                        issues.append(
                            f"Connection references missing target node '{c['target_node']}'"
                        )

                # Check for orphan nodes (no connections, except Start)
                connected_nodes = set()
                for c in shadow.connections:
                    connected_nodes.add(c["source_node"])
                    connected_nodes.add(c["target_node"])
                for name, node in shadow.nodes.items():
                    if node.type != "Start" and name not in connected_nodes:
                        issues.append(f"Node '{name}' is not connected to anything")

                return {
                    "valid": len(issues) == 0,
                    "issues": issues,
                    "node_count": len(shadow.nodes),
                    "connection_count": len(shadow.connections),
                }
            except Exception as e:
                return {"error": str(e)}

        def test_expression(expression: str, sample_data: dict | None = None) -> dict:
            """Test a workflow expression with sample data. Use this to verify expressions
            like '{{ $json.field }}' work correctly before putting them in node parameters.

            Args:
                expression: The expression to test (e.g. '{{ $json.name }}').
                sample_data: Sample JSON data to evaluate the expression against.
            """
            try:
                engine = ExpressionEngine()
                ctx = ExpressionContext(
                    json_data=sample_data or {},
                    input_data=[NodeData(json=sample_data or {})],
                    node_data={},
                    env={},
                    execution={"id": "test", "mode": "manual"},
                    item_index=0,
                )
                result = engine.resolve(expression, ctx)
                return {
                    "expression": expression,
                    "result": result,
                    "result_type": type(result).__name__,
                }
            except Exception as e:
                return {"error": f"Expression error: {e}", "expression": expression}

        return [
            # Read
            inspect_workflow,
            inspect_node,
            get_node_schema,
            search_node_types,
            # Write
            add_node,
            update_node,
            remove_node,
            add_connection,
            remove_connection,
            generate_full_workflow,
            # Execute / Validate
            run_workflow,
            validate_workflow,
            test_expression,
        ]

    # ------------------------------------------------------------------
    # System instruction
    # ------------------------------------------------------------------

    def _build_instruction(self) -> str:
        catalog = self._build_node_catalog()
        return (
            "You are an expert workflow automation assistant.\n\n"
            "## Your Process\n"
            "1. READ: Use inspect_workflow() and inspect_node() to understand current state\n"
            "2. PLAN: Decide what changes to make\n"
            "3. EDIT: Use write tools to make changes\n"
            "4. TEST: Use validate_workflow() to check for issues\n"
            "5. FIX: If errors found, go back to step 1\n\n"
            "Never modify blindly. Always inspect first when a workflow exists.\n\n"
            "## Mode-Specific Behavior\n"
            "- GENERATE: Use generate_full_workflow(). Always include a Start node. "
            "Validate after.\n"
            "- MODIFY: inspect_workflow() first, then use incremental tools "
            "(add_node, update_node, remove_node, add_connection, remove_connection). "
            "Validate after.\n"
            "- FIX: run_workflow() first to see errors, then fix, then run again.\n"
            "- EXPLAIN: Use read tools only (inspect_workflow, inspect_node). "
            "Do NOT call write tools.\n\n"
            "## Node Naming\n"
            "Use descriptive, unique names. For single-purpose nodes use the type "
            "(e.g. Start, Merge). For multiple nodes of the same type, use "
            "descriptive names (e.g. GetUsers, GetPosts, FilterActive, CheckCount).\n\n"
            "## Data Flow\n"
            "Data flows through connections between nodes. Each node receives input "
            "from its predecessor(s) as a list of items.\n"
            "- Each item is a dict like `{\"json\": {\"field\": \"value\"}}`\n"
            "- The `$json` variable refers to the current item's json data\n"
            "- To access another node's output: `$node[\"NodeName\"].json.field`\n\n"
            "## Expression Syntax\n"
            "Inside node parameters (strings) you can use `{{ }}` expressions:\n"
            "- `{{ $json.field }}` — current input item's field\n"
            '- `{{ $node["NodeName"].json.field }}` — specific node\'s output\n'
            "- `{{ $json.items.length() }}` — call functions on data\n"
            "- `{{ $execution.id }}` — execution metadata\n\n"
            "## Code Node\n"
            "The Code node runs Python in a sandbox. Available variables:\n"
            "- `items`: list of input items, each `{\"json\": {...}}`\n"
            "- `json_data`: shortcut for first item's json (dict)\n"
            "- `node_data`: dict to access other nodes' output, e.g. "
            '`node_data["GetUsers"]["json"]`\n'
            "- `new_item(data)`: create `{\"json\": data}`\n"
            "- `get_item(index)`: get item at index\n"
            "- Available modules: json, math, re, random, datetime, pandas (as pd)\n"
            "- Must RETURN a list of `{\"json\": {...}}` items (or a single dict).\n\n"
            "Example Code node that transforms data:\n"
            "```python\n"
            "result = []\n"
            "for item in items:\n"
            "    d = item[\"json\"]\n"
            "    result.append({\"json\": {\"name\": d.get(\"name\", \"\").upper()}})\n"
            "return result\n"
            "```\n\n"
            "Example Code node accessing another node's output:\n"
            "```python\n"
            "users = node_data[\"GetUsers\"][\"data\"]  # list of json dicts\n"
            "posts = node_data[\"GetPosts\"][\"data\"]   # list of json dicts\n"
            "# join them\n"
            "result = []\n"
            "for u in users:\n"
            "    user_posts = [p for p in posts if p.get(\"userId\") == u.get(\"id\")]\n"
            "    result.append({\"json\": {**u, \"posts\": user_posts}})\n"
            "return result\n"
            "```\n\n"
            "## Connection Outputs\n"
            "Most nodes output to 'main'. Special cases:\n"
            "- **If node**: outputs to 'true' and 'false'\n"
            "- **Loop node**: outputs to 'loop' (each iteration) and 'done' (after loop)\n"
            "- **SplitInBatches**: outputs to 'loop' and 'done'\n"
            "Always use the correct output name when connecting from these nodes.\n\n"
            f"## Available Node Types (condensed)\n{catalog}\n\n"
            "For full parameter details on any type, call get_node_schema(type_name).\n\n"
            "## Response Style\n"
            "Always provide a brief conversational explanation of what you did or "
            "what the workflow does."
        )

    # ------------------------------------------------------------------
    # Streaming chat (per-request agent)
    # ------------------------------------------------------------------

    async def stream_chat(
        self, request: AIChatRequest
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Stream a chat response, yielding SSE event dicts.

        SSE contract (unchanged):
          - text       : { type: "text",       content: "..." }
          - operations : { type: "operations", payload: { mode, ... } }
          - error      : { type: "error",      message: "..." }
          - done       : { type: "done" }
        """
        try:
            # -- Build shadow workflow from request context ----------------
            shadow = ShadowWorkflow.from_workflow_context(request.workflow_context)

            # -- Per-request agent with bound tools -----------------------
            bound_tools = self._build_tools(shadow)

            agent = Agent(
                name="workflow_assistant",
                model=AGENT_MODEL,
                description=(
                    "Workflow automation assistant that creates and modifies "
                    "node-based workflows."
                ),
                instruction=self._build_instruction(),
                tools=bound_tools,
            )

            runner = Runner(
                agent=agent,
                app_name=self.APP_NAME,
                session_service=self._session_service,
                auto_create_session=True,
            )

            session_id = request.session_id or f"session_{uuid.uuid4().hex[:12]}"
            user_id = "workflow_user"

            # ----- Build user message ------------------------------------
            parts: list[str] = []

            # Conversation history (capped)
            if request.conversation_history:
                history = request.conversation_history[-self._MAX_HISTORY_MESSAGES :]
                parts.append("[Previous conversation]")
                for msg in history:
                    role = "User" if msg.role == "user" else "Assistant"
                    content = msg.content[: self._MAX_MESSAGE_CHARS]
                    parts.append(f"{role}: {content}")
                parts.append("")

            # Workflow context — don't dump JSON, tell agent to use tools
            if request.workflow_context:
                node_count = len(request.workflow_context.nodes or [])
                if node_count > 0:
                    parts.append(
                        f"[There is a workflow '{request.workflow_context.name}' "
                        f"with {node_count} node(s) on the canvas. "
                        f"Use inspect_workflow() to see details.]"
                    )
                else:
                    parts.append("[The canvas is empty.]")

            # Mode hint
            if request.mode_hint and request.mode_hint != "auto":
                hint_map = {
                    "generate": "The user wants to generate/create a new workflow.",
                    "modify": "The user wants to modify the existing workflow.",
                    "explain": "The user wants an explanation — use read tools only, do NOT call write tools.",
                    "fix": "The user wants you to fix issues in the existing workflow.",
                }
                hint = hint_map.get(request.mode_hint, "")
                if hint:
                    parts.append(f"[Hint: {hint}]")

            parts.append(request.message)
            user_text = "\n".join(parts)

            content = types.Content(
                role="user",
                parts=[types.Part(text=user_text)],
            )

            # ----- Run agent and collect final text ----------------------
            final_text = ""

            async for event in runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=content,
            ):
                if event.is_final_response():
                    if event.content and event.content.parts:
                        final_text = event.content.parts[0].text or ""
                    elif event.actions and event.actions.escalate:
                        final_text = (
                            f"Agent escalated: "
                            f"{event.error_message or 'No specific reason.'}"
                        )

            # ----- Emit SSE events ---------------------------------------

            # 1. Text response
            if final_text:
                yield {
                    "event": "text",
                    "data": json.dumps({"type": "text", "content": final_text}),
                }

            # 2. Operations — from shadow workflow's operation log
            ops = shadow.get_operation_log()
            if ops:
                # Check if it's a full workflow replacement
                if len(ops) == 1 and ops[0].get("op") == "replaceAll":
                    replace_op = ops[0]
                    full_wf = {
                        "mode": "full_workflow",
                        "workflow": {
                            "name": replace_op["name"],
                            "nodes": replace_op["nodes"],
                            "connections": replace_op["connections"],
                        },
                        "summary": f"Generated workflow with {len(replace_op['nodes'])} nodes",
                    }
                    yield {
                        "event": "operations",
                        "data": json.dumps({"type": "operations", "payload": full_wf}),
                    }
                else:
                    # Filter out internal replaceAll ops; emit incremental
                    inc_ops = [o for o in ops if o.get("op") != "replaceAll"]
                    if inc_ops:
                        payload = {
                            "mode": "incremental",
                            "operations": inc_ops,
                            "summary": f"Applied {len(inc_ops)} operation(s)",
                        }
                        yield {
                            "event": "operations",
                            "data": json.dumps({"type": "operations", "payload": payload}),
                        }

        except Exception as exc:
            logger.exception("AI chat stream error")
            yield {
                "event": "error",
                "data": json.dumps({
                    "type": "error",
                    "message": f"Agent error: {exc}",
                }),
            }

        yield {"event": "done", "data": json.dumps({"type": "done"})}
