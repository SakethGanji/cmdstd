"""Unified LLM provider backed by LiteLLM."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

import litellm


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


class LLMProviderError(Exception):
    """Custom exception for LLM provider errors."""


@dataclass
class LLMTool:
    """OpenAI-standard tool definition."""

    name: str
    description: str
    parameters: dict[str, Any] = field(default_factory=dict)

    def to_litellm(self) -> dict[str, Any]:
        """Convert to LiteLLM/OpenAI tool format."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters or {"type": "object", "properties": {}},
            },
        }


@dataclass
class LLMToolCall:
    """Parsed tool call from model response."""

    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class LLMMessage:
    """Conversation message."""

    role: str  # "system", "user", "assistant", "tool"
    content: str | None = None
    tool_calls: list[LLMToolCall] | None = None
    tool_call_id: str | None = None

    def to_litellm(self) -> dict[str, Any]:
        """Convert to LiteLLM/OpenAI message format."""
        msg: dict[str, Any] = {"role": self.role}

        if self.content is not None:
            msg["content"] = self.content

        if self.tool_calls:
            msg["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.name,
                        "arguments": json.dumps(tc.arguments)
                        if isinstance(tc.arguments, dict)
                        else tc.arguments,
                    },
                }
                for tc in self.tool_calls
            ]
            # OpenAI format: assistant messages with tool_calls may have null content
            if self.content is None:
                msg["content"] = None

        if self.tool_call_id is not None:
            msg["tool_call_id"] = self.tool_call_id

        return msg


@dataclass
class LLMUsage:
    """Token usage counts."""

    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


@dataclass
class LLMResponse:
    """Normalized non-streaming response."""

    content: str | None = None
    tool_calls: list[LLMToolCall] | None = None
    usage: LLMUsage = field(default_factory=LLMUsage)
    finish_reason: str | None = None


@dataclass
class LLMChunk:
    """Streaming chunk."""

    content: str | None = None
    tool_calls: list[LLMToolCall] | None = None
    finish_reason: str | None = None


# ---------------------------------------------------------------------------
# Provider
# ---------------------------------------------------------------------------

# Suppress LiteLLM's noisy logs
litellm.suppress_debug_info = True


class LLMProvider:
    """Unified LLM provider backed by LiteLLM."""

    def __init__(self) -> None:
        self._configure_api_keys()

    def _configure_api_keys(self) -> None:
        """Read keys from config.py settings + env fallback, set in env for LiteLLM."""
        from ..core.config import settings

        key_map = {
            "GEMINI_API_KEY": getattr(settings, "gemini_api_key", None),
            "OPENAI_API_KEY": getattr(settings, "openai_api_key", None),
            "ANTHROPIC_API_KEY": getattr(settings, "anthropic_api_key", None),
        }

        for env_var, config_val in key_map.items():
            value = config_val or os.environ.get(env_var, "")
            if value:
                os.environ[env_var] = value

    @staticmethod
    def normalize_model_name(model: str) -> str:
        """Add LiteLLM provider prefixes for known model families.

        - gemini-* -> gemini/gemini-*
        - claude-* -> anthropic/claude-*
        - gpt-*   -> unchanged (OpenAI is default)
        """
        if model.startswith("gemini/") or model.startswith("anthropic/") or model.startswith("openai/"):
            return model

        if model.startswith("gemini-"):
            return f"gemini/{model}"
        if model.startswith("claude-"):
            return f"anthropic/{model}"
        # gpt-* and others pass through unchanged (LiteLLM default is OpenAI)
        return model

    async def chat(
        self,
        model: str,
        messages: list[LLMMessage],
        tools: list[LLMTool] | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        """Non-streaming completion via litellm.acompletion()."""
        litellm_model = self.normalize_model_name(model)
        litellm_messages = [m.to_litellm() for m in messages]

        kwargs: dict[str, Any] = {
            "model": litellm_model,
            "messages": litellm_messages,
        }
        if tools:
            kwargs["tools"] = [t.to_litellm() for t in tools]
        if temperature is not None:
            kwargs["temperature"] = temperature
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens

        try:
            response = await litellm.acompletion(**kwargs)
        except Exception as e:
            raise LLMProviderError(f"LLM API error: {e}") from e

        return self._parse_response(response)

    async def chat_stream(
        self,
        model: str,
        messages: list[LLMMessage],
        tools: list[LLMTool] | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> AsyncIterator[LLMChunk]:
        """Streaming completion with tool-call delta accumulation."""
        litellm_model = self.normalize_model_name(model)
        litellm_messages = [m.to_litellm() for m in messages]

        kwargs: dict[str, Any] = {
            "model": litellm_model,
            "messages": litellm_messages,
            "stream": True,
        }
        if tools:
            kwargs["tools"] = [t.to_litellm() for t in tools]
        if temperature is not None:
            kwargs["temperature"] = temperature
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens

        try:
            response = await litellm.acompletion(**kwargs)
        except Exception as e:
            raise LLMProviderError(f"LLM API error: {e}") from e

        # Accumulate tool call deltas
        tool_call_accum: dict[int, dict[str, Any]] = {}

        async for chunk in response:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta is None:
                continue

            finish_reason = chunk.choices[0].finish_reason

            content = getattr(delta, "content", None)
            tc_deltas = getattr(delta, "tool_calls", None)

            if tc_deltas:
                for tc_delta in tc_deltas:
                    idx = tc_delta.index
                    if idx not in tool_call_accum:
                        tool_call_accum[idx] = {
                            "id": tc_delta.id or "",
                            "name": "",
                            "arguments": "",
                        }
                    entry = tool_call_accum[idx]
                    if tc_delta.id:
                        entry["id"] = tc_delta.id
                    if tc_delta.function:
                        if tc_delta.function.name:
                            entry["name"] += tc_delta.function.name
                        if tc_delta.function.arguments:
                            entry["arguments"] += tc_delta.function.arguments

            if finish_reason == "tool_calls" and tool_call_accum:
                parsed_calls = []
                for _idx in sorted(tool_call_accum.keys()):
                    entry = tool_call_accum[_idx]
                    try:
                        args = json.loads(entry["arguments"]) if entry["arguments"] else {}
                    except json.JSONDecodeError:
                        args = {}
                    parsed_calls.append(
                        LLMToolCall(id=entry["id"], name=entry["name"], arguments=args)
                    )
                yield LLMChunk(tool_calls=parsed_calls, finish_reason=finish_reason)
                tool_call_accum.clear()
            elif content or finish_reason:
                yield LLMChunk(content=content, finish_reason=finish_reason)

    def _parse_response(self, response: Any) -> LLMResponse:
        """Normalize LiteLLM ModelResponse to LLMResponse."""
        choice = response.choices[0] if response.choices else None
        if choice is None:
            return LLMResponse()

        content = choice.message.content
        finish_reason = choice.finish_reason

        # Parse tool calls
        tool_calls = None
        raw_tc = getattr(choice.message, "tool_calls", None)
        if raw_tc:
            tool_calls = []
            for tc in raw_tc:
                try:
                    args = json.loads(tc.function.arguments) if tc.function.arguments else {}
                except json.JSONDecodeError:
                    args = {}
                tool_calls.append(
                    LLMToolCall(id=tc.id, name=tc.function.name, arguments=args)
                )

        # Parse usage
        usage = LLMUsage()
        raw_usage = getattr(response, "usage", None)
        if raw_usage:
            usage = LLMUsage(
                input_tokens=getattr(raw_usage, "prompt_tokens", 0) or 0,
                output_tokens=getattr(raw_usage, "completion_tokens", 0) or 0,
                total_tokens=getattr(raw_usage, "total_tokens", 0) or 0,
            )

        return LLMResponse(
            content=content,
            tool_calls=tool_calls,
            usage=usage,
            finish_reason=finish_reason,
        )


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_provider_instance: LLMProvider | None = None


def get_llm_provider() -> LLMProvider:
    """Return shared LLMProvider instance."""
    global _provider_instance
    if _provider_instance is None:
        _provider_instance = LLMProvider()
    return _provider_instance
