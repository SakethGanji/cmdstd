"""AI Chat service — LLM-powered workflow assistant."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator

from ..core.config import settings
from ..engine.llm_provider import call_llm
from ..engine.node_registry import NodeRegistryClass
from ..engine.types import (
    Connection,
    NodeData,
    NodeDefinition,
    Workflow,
)
from ..schemas.ai_chat import AIChatRequest

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model configuration
# ---------------------------------------------------------------------------
AGENT_MODEL = "gemini-2.0-flash"


# ---------------------------------------------------------------------------
# ShadowWorkflow — mutable in-memory workflow (kept for future tool use)
# ---------------------------------------------------------------------------


@dataclass
class ShadowNode:
    """Lightweight mutable node representation."""

    name: str
    type: str
    parameters: dict[str, Any] = field(default_factory=dict)


class ShadowWorkflow:
    """Server-side mutable workflow."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.nodes: dict[str, ShadowNode] = {}
        self.connections: list[dict[str, str]] = []
        self._operation_log: list[dict[str, Any]] = []

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
                f"{c['source_node']}->{c['target_node']}" for c in self.connections
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
    """LLM-powered workflow assistant (basic single-turn for now)."""

    _MAX_HISTORY_MESSAGES = 20
    _MAX_MESSAGE_CHARS = 500

    def __init__(self, node_registry: NodeRegistryClass) -> None:
        self._registry = node_registry
        self._node_catalog: str | None = None

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

            groups.setdefault(group, []).append("\n".join(entry_parts))

        lines: list[str] = []
        for group_name, entries in groups.items():
            lines.append(f"\n### {group_name.title()}")
            lines.extend(entries)

        self._node_catalog = "\n".join(lines)
        return self._node_catalog

    # ------------------------------------------------------------------
    # System instruction
    # ------------------------------------------------------------------

    def _build_system_prompt(self, shadow: ShadowWorkflow) -> str:
        catalog = self._build_node_catalog()
        workflow_state = json.dumps(shadow.get_summary(), indent=2)

        return (
            "You are an expert workflow automation assistant.\n\n"
            f"## Available Node Types\n{catalog}\n\n"
            f"## Current Workflow State\n```json\n{workflow_state}\n```\n\n"
            "Help the user understand, build, and modify workflows. "
            "Explain what nodes do, suggest workflow designs, and answer questions "
            "about workflow automation."
        )

    # ------------------------------------------------------------------
    # Build user message from request
    # ------------------------------------------------------------------

    def _build_user_message(self, request: AIChatRequest) -> str:
        parts: list[str] = []

        # Conversation history (capped)
        if request.conversation_history:
            history = request.conversation_history[-self._MAX_HISTORY_MESSAGES:]
            parts.append("[Previous conversation]")
            for msg in history:
                role = "User" if msg.role == "user" else "Assistant"
                content = msg.content[:self._MAX_MESSAGE_CHARS]
                parts.append(f"{role}: {content}")
            parts.append("")

        parts.append(request.message)
        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Streaming chat — basic single-turn LLM call
    # ------------------------------------------------------------------

    async def stream_chat(
        self, request: AIChatRequest
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Stream a chat response, yielding SSE event dicts.

        SSE contract:
          - text  : { type: "text",  content: "..." }
          - error : { type: "error", message: "..." }
          - done  : { type: "done" }
        """
        try:
            shadow = ShadowWorkflow.from_workflow_context(request.workflow_context)

            messages = [
                {"role": "system", "content": self._build_system_prompt(shadow)},
                {"role": "user", "content": self._build_user_message(request)},
            ]

            response = await call_llm(
                model=AGENT_MODEL,
                messages=messages,
                temperature=0.4,
                max_tokens=4096,
            )

            text = response.text or ""
            if text:
                yield {
                    "event": "text",
                    "data": json.dumps({"type": "text", "content": text}),
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
