"""Unified LLM provider backed by LiteLLM.

Supports:
- Company internal proxy (OpenAI-compatible Vertex AI gateway)
- Direct API keys for Gemini, OpenAI, Anthropic (development/personal use)
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

import litellm


# ---------------------------------------------------------------------------
# Data classes (unchanged — these are the public interface)
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
# COIN token helper (placeholder — replace with your company's implementation)
# ---------------------------------------------------------------------------


def get_coin_token() -> str:
    """Get authentication token for the company LLM proxy.

    TODO: Replace this placeholder with your company's COIN token refresh logic.
    For now reads from COIN_TOKEN env var.
    """
    token = os.environ.get("COIN_TOKEN", "")
    if not token:
        raise LLMProviderError(
            "COIN_TOKEN environment variable not set. "
            "Set it or implement get_coin_token() with your company's auth."
        )
    return token


# ---------------------------------------------------------------------------
# Model registry — maps model names to proxy routing info
# ---------------------------------------------------------------------------

# Models available through the company proxy with their Vertex AI regions
COMPANY_MODELS: dict[str, dict[str, str]] = {
    # Gemini models
    "gemini-2.0-flash": {"region": "us-central1"},
    "gemini-2.0-flash-001": {"region": "us-central1"},
    "gemini-1.5-flash": {"region": "us-central1"},
    "gemini-1.5-pro": {"region": "us-central1"},
    # Meta LLaMA models
    "meta/llama-4-maverick-17b-128e-instruct-maas": {"region": "us-east5"},
    "meta/llama-4-scout-17b-16e-instruct-maas": {"region": "us-east5"},
    "meta/llama-3.3-70b-instruct-maas": {"region": "us-central1"},
    "meta/llama-3.1-405b-instruct-maas": {"region": "us-central1"},
}

# Default company proxy base URL template
_DEFAULT_PROXY_TEMPLATE = (
    "https://r2d2-c3p0-icg-msst-genaihub-178909.apps.namicg39023u"
    ".ecs.dyn.nsroot.net/vertex/v1beta1/projects/{project}"
    "/locations/{region}/endpoints/openapi"
)


# ---------------------------------------------------------------------------
# Provider
# ---------------------------------------------------------------------------

# Suppress LiteLLM's noisy logs
litellm.suppress_debug_info = True


class LLMProvider:
    """Unified LLM provider.

    Routing logic:
    1. If the model is in COMPANY_MODELS → route through company proxy
       (OpenAI-compatible endpoint with COIN auth)
    2. Otherwise → route through LiteLLM's default providers
       (uses GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY env vars)
    """

    def __init__(self) -> None:
        self._configure()

    def _configure(self) -> None:
        """Configure API keys and SSL for both company proxy and direct access."""
        from ..core.config import settings

        # Company proxy SSL cert
        ssl_cert = getattr(settings, "ssl_cert_file", None) or os.environ.get("SSL_CERT_FILE")
        if ssl_cert:
            os.environ["SSL_CERT_FILE"] = ssl_cert

        # Direct-access API keys (for development / non-company models)
        key_map = {
            "GEMINI_API_KEY": getattr(settings, "gemini_api_key", None),
            "OPENAI_API_KEY": getattr(settings, "openai_api_key", None),
            "ANTHROPIC_API_KEY": getattr(settings, "anthropic_api_key", None),
        }
        for env_var, config_val in key_map.items():
            value = config_val or os.environ.get(env_var, "")
            if value:
                os.environ[env_var] = value

        # Store company proxy settings
        self._proxy_base_url = getattr(settings, "llm_proxy_base_url", None)
        self._proxy_project = getattr(settings, "llm_proxy_project", "prj-gen-ai-9571")

    def _get_company_proxy_url(self, model: str) -> str | None:
        """Get the company proxy URL for a model, or None if not a company model."""
        model_info = COMPANY_MODELS.get(model)
        if model_info is None:
            return None

        if self._proxy_base_url:
            return self._proxy_base_url

        return _DEFAULT_PROXY_TEMPLATE.format(
            project=self._proxy_project,
            region=model_info["region"],
        )

    def _build_kwargs(
        self,
        model: str,
        messages: list[LLMMessage],
        tools: list[LLMTool] | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        stream: bool = False,
    ) -> dict[str, Any]:
        """Build kwargs for litellm.acompletion, routing to company proxy or direct."""
        litellm_messages = [m.to_litellm() for m in messages]

        proxy_url = self._get_company_proxy_url(model)

        if proxy_url:
            # Route through company's OpenAI-compatible proxy
            kwargs: dict[str, Any] = {
                "model": f"openai/{model}",  # Tell LiteLLM to use OpenAI protocol
                "messages": litellm_messages,
                "api_base": proxy_url,
                "api_key": get_coin_token(),
            }
        else:
            # Route through LiteLLM's default provider resolution
            kwargs = {
                "model": self._normalize_for_litellm(model),
                "messages": litellm_messages,
            }

        if tools:
            kwargs["tools"] = [t.to_litellm() for t in tools]
        if temperature is not None:
            kwargs["temperature"] = temperature
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens
        if stream:
            kwargs["stream"] = True

        return kwargs

    @staticmethod
    def _normalize_for_litellm(model: str) -> str:
        """Add LiteLLM provider prefixes for direct API access.

        Only used for non-company models that go through LiteLLM's default routing.
        """
        if model.startswith(("gemini/", "anthropic/", "openai/")):
            return model
        if model.startswith("gemini-"):
            return f"gemini/{model}"
        if model.startswith("claude-"):
            return f"anthropic/{model}"
        return model

    async def chat(
        self,
        model: str,
        messages: list[LLMMessage],
        tools: list[LLMTool] | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        """Non-streaming completion."""
        kwargs = self._build_kwargs(model, messages, tools, temperature, max_tokens)

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
        kwargs = self._build_kwargs(model, messages, tools, temperature, max_tokens, stream=True)

        try:
            response = await litellm.acompletion(**kwargs)
        except Exception as e:
            raise LLMProviderError(f"LLM API error: {e}") from e

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
