"""AI Chat service — streams Gemini responses as SSE events."""

from __future__ import annotations

import json
import os
import re
from typing import Any, AsyncGenerator

import httpx

from ..engine.node_registry import NodeRegistryClass
from ..schemas.ai_chat import AIChatRequest


class AIChatService:
    """Handles AI chat interactions using Google Gemini API."""

    def __init__(self, node_registry: NodeRegistryClass) -> None:
        self._registry = node_registry
        self._node_catalog: str | None = None
        self._system_prompt_base: str | None = None

    # ------------------------------------------------------------------
    # Node catalog (built once, cached)
    # ------------------------------------------------------------------

    def _build_node_catalog(self) -> str:
        """Build a condensed node catalog string from the registry."""
        if self._node_catalog is not None:
            return self._node_catalog

        infos = self._registry.get_node_info_full()

        # Group by first group tag
        groups: dict[str, list[str]] = {}
        for info in infos:
            if info.is_subnode:
                continue  # skip subnodes in catalog
            group = (info.group or ["other"])[0]
            entry_parts = [f"- **{info.type}**: {info.description}"]

            # Key parameters (name + type only)
            if info.properties:
                param_strs = []
                for p in info.properties[:6]:  # limit to 6 params
                    param_strs.append(f"{p['name']}({p['type']})")
                if param_strs:
                    entry_parts.append(f"  Params: {', '.join(param_strs)}")

            # Inputs/outputs
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
    # System prompt
    # ------------------------------------------------------------------

    def _build_system_prompt(self, request: AIChatRequest) -> str:
        """Assemble the full system prompt for the conversation."""
        catalog = self._build_node_catalog()

        parts: list[str] = []

        # 1. Role
        parts.append(
            "You are a workflow automation assistant. You help users create, modify, "
            "explain, and fix workflows. Workflows are directed acyclic graphs of nodes "
            "connected by edges. Each node has a type, a unique name, and parameters."
        )

        # 2. Workflow JSON format
        parts.append(
            "## Workflow format\n"
            "A workflow has: name (string), nodes (array), connections (array).\n"
            "Each node: { name, type, parameters }.\n"
            "Each connection: { source_node, target_node, source_output (default 'main'), target_input (default 'main') }.\n"
            "Node names must be unique. Use the type as the base name, appending a number if duplicated (e.g. HttpRequest, HttpRequest1)."
        )

        # 3. Expression syntax
        parts.append(
            "## Expression syntax\n"
            "Inside node parameters you can use expressions:\n"
            "- `{{ $json.field }}` — access input data\n"
            "- `{{ $node[\"NodeName\"].json.field }}` — access another node's output"
        )

        # 4. Node catalog
        parts.append(f"## Available nodes\n{catalog}")

        # 5. Response format
        parts.append(
            "## Response format\n"
            "Always include a brief conversational explanation of what you did or what the workflow does.\n\n"
            "When you create or modify a workflow, also emit a JSON code block (```json ... ```) with this structure:\n"
            "```\n"
            "{\n"
            '  "mode": "full_workflow" | "incremental" | "explanation",\n'
            '  "workflow": { "name": "...", "nodes": [...], "connections": [...] } | null,\n'
            '  "operations": [ ... ] | null,\n'
            '  "summary": "short summary"\n'
            "}\n"
            "```\n\n"
            "**Mode selection rules:**\n"
            "- Use `full_workflow` when creating a brand-new workflow from scratch, or when the user asks to generate/create a workflow.\n"
            "- Use `incremental` when the user asks to add, remove, or update specific nodes/connections in an existing workflow.\n"
            "  Each operation is a flat object with an `op` field. Valid operations:\n"
            '  `{ "op": "addNode", "type": "...", "name": "...", "parameters": {...}, "connect_after": "..." }`\n'
            '  `{ "op": "updateNode", "name": "...", "parameters": {...} }`\n'
            '  `{ "op": "removeNode", "name": "..." }`\n'
            '  `{ "op": "addConnection", "source_node": "...", "target_node": "...", "source_output": "main", "target_input": "main" }`\n'
            '  `{ "op": "removeConnection", "source_node": "...", "target_node": "..." }`\n'
            "- Use `explanation` when the user asks to explain the workflow or answer questions (no JSON block needed).\n\n"
            "For `full_workflow`, always include a Start node as the entry point.\n"
            "For `addNode`, the `connect_after` field is the name of an existing node to connect from (source_output='main', target_input='main')."
        )

        # 6. Current workflow context
        if request.workflow_context:
            ctx = request.workflow_context
            ctx_json = json.dumps(
                {"name": ctx.name, "nodes": ctx.nodes, "connections": ctx.connections},
                indent=2,
            )
            parts.append(
                f"## Current workflow\nThe user currently has this workflow open:\n```json\n{ctx_json}\n```"
            )
        else:
            parts.append("## Current workflow\nThe user has no workflow open (empty canvas).")

        return "\n\n".join(parts)

    # ------------------------------------------------------------------
    # Streaming chat
    # ------------------------------------------------------------------

    async def stream_chat(self, request: AIChatRequest) -> AsyncGenerator[dict[str, Any], None]:
        """Stream a chat response from Gemini, yielding SSE event dicts."""
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            yield {"event": "error", "data": json.dumps({"type": "error", "message": "GEMINI_API_KEY not set. Configure it in your environment."})}
            return

        system_prompt = self._build_system_prompt(request)

        # Build conversation contents
        contents: list[dict[str, Any]] = []
        for msg in request.conversation_history:
            contents.append({
                "role": "user" if msg.role == "user" else "model",
                "parts": [{"text": msg.content}],
            })
        # Add the current user message
        contents.append({"role": "user", "parts": [{"text": request.message}]})

        body: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 8192,
            },
            "systemInstruction": {"parts": [{"text": system_prompt}]},
        }

        model = "gemini-2.0-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent"

        full_text = ""

        try:
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    url,
                    params={"alt": "sse", "key": api_key},
                    json=body,
                    timeout=120.0,
                ) as response:
                    if response.status_code != 200:
                        error_body = ""
                        async for chunk in response.aiter_text():
                            error_body += chunk
                        yield {
                            "event": "error",
                            "data": json.dumps({
                                "type": "error",
                                "message": f"Gemini API error ({response.status_code}): {error_body[:500]}",
                            }),
                        }
                        return

                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:]
                        if not raw.strip():
                            continue

                        try:
                            chunk_data = json.loads(raw)
                        except json.JSONDecodeError:
                            continue

                        candidates = chunk_data.get("candidates", [])
                        if not candidates:
                            continue

                        parts = candidates[0].get("content", {}).get("parts", [])
                        for part in parts:
                            text = part.get("text", "")
                            if text:
                                full_text += text
                                yield {
                                    "event": "text",
                                    "data": json.dumps({"type": "text", "content": text}),
                                }

        except httpx.HTTPError as exc:
            yield {
                "event": "error",
                "data": json.dumps({"type": "error", "message": f"Network error: {exc}"}),
            }
            return

        # Try to extract structured operations from the full text
        operations_payload = self._parse_structured_response(full_text)
        if operations_payload:
            yield {
                "event": "operations",
                "data": json.dumps({"type": "operations", "payload": operations_payload}),
            }

        yield {"event": "done", "data": json.dumps({"type": "done"})}

    # ------------------------------------------------------------------
    # Parse structured JSON from LLM response
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_structured_response(text: str) -> dict[str, Any] | None:
        """Extract JSON code block from the LLM's markdown response."""
        # Try ```json ... ``` blocks
        pattern = r"```json\s*\n?(.*?)```"
        matches = re.findall(pattern, text, re.DOTALL)
        for match in matches:
            try:
                parsed = json.loads(match.strip())
                if isinstance(parsed, dict) and "mode" in parsed:
                    return parsed
            except json.JSONDecodeError:
                continue

        # Fallback: try ``` ... ``` without json tag
        pattern2 = r"```\s*\n?(.*?)```"
        matches2 = re.findall(pattern2, text, re.DOTALL)
        for match in matches2:
            try:
                parsed = json.loads(match.strip())
                if isinstance(parsed, dict) and "mode" in parsed:
                    return parsed
            except json.JSONDecodeError:
                continue

        return None
