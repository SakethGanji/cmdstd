"""
LLM Provider Fixes Guide
=========================

Apply these fixes to the other system's llm_provider.py to make it work
with the workflow-engine's AI agent tool calling.

Fixes needed (2):

    FIX 1: System prompt handling            — use system_instruction instead of prepending
    FIX 2: Missing parameters in OpenAI tool schema (_function_to_openai_tool bug)

Priority:
    FIX 2 is a BUG  — tool parameters are silently dropped, LLM can't call tools properly
    FIX 1 is best practice — improves prompt quality

Sources:
    - Gemini function calling: https://ai.google.dev/gemini-api/docs/function-calling
    - Google GenAI Python SDK: https://googleapis.github.io/python-genai/
    - Vertex AI system instructions: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/system-instructions
    - OpenAI function calling: https://platform.openai.com/docs/guides/function-calling
"""


# =============================================================================
# FIX 1: In _call_gemini_vertex(), use system_instruction instead of prepending
#
# WHY: Your code extracts the system prompt and prepends it to the first user
#      message. The official SDK has a dedicated system_instruction parameter
#      in GenerateContentConfig that gives Gemini proper system-level context.
#      This produces better results because the model treats it as a system
#      instruction rather than user text.
#
#      Confirmed in official docs:
#      https://googleapis.github.io/python-genai/
#      https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/system-instructions
#
# FIND THIS (in _convert_messages_to_gemini_content):
#
#     system_prompt = None
#     if messages and messages[0]['role'] == 'system':
#         system_prompt = messages[0]['content']
#         messages = messages[1:]
#     ...
#     if i == 0 and role == "user" and system_prompt:
#         content = f"{system_prompt}\n\n{content}"
#
# REPLACE _convert_messages_to_gemini_content to return system_prompt separately:
# =============================================================================

def _fix1_convert_messages(messages):
    """Shows how _convert_messages_to_gemini_content should extract system prompt."""
    from google.genai.types import Content, Part
    import json

    system_instruction = None
    contents = []

    for msg in messages:
        role = msg["role"]
        content = msg.get("content") or ""

        if role == "system":
            system_instruction = content  # <-- extract, don't prepend
            continue

        if role == "user":
            contents.append(Content(role="user", parts=[Part(text=content)]))

        elif role == "assistant":
            if msg.get("tool_calls"):
                parts = []
                for tc in msg["tool_calls"]:
                    fn = tc.get("function", {})
                    args_raw = fn.get("arguments", "{}")
                    try:
                        args = json.loads(args_raw) if isinstance(args_raw, str) else args_raw
                    except json.JSONDecodeError:
                        args = {}
                    parts.append(Part.from_function_call(name=fn.get("name"), args=args))
                contents.append(Content(role="model", parts=parts))
            elif content:
                contents.append(Content(role="model", parts=[Part(text=content)]))

        elif role == "tool":
            try:
                resp = json.loads(msg["content"]) if isinstance(msg.get("content"), str) else msg.get("content", {})
                if not isinstance(resp, dict):
                    resp = {"content": resp}
            except (json.JSONDecodeError, TypeError):
                resp = {"content": str(msg.get("content", ""))}

            name = msg.get("name", "unknown")
            contents.append(Content(
                role="user",
                parts=[Part.from_function_response(name=name, response=resp)],
            ))

    return contents, system_instruction  # <-- return system_instruction separately


def _fix1_use_in_config(messages, temperature, kwargs):
    """Shows how to pass system_instruction in GenerateContentConfig."""
    from google.genai.types import GenerateContentConfig

    contents, system_instruction = _fix1_convert_messages(messages)

    config_kwargs = {"temperature": temperature}

    if system_instruction:
        config_kwargs["system_instruction"] = system_instruction  # <-- official way

    if "max_tokens" in kwargs and kwargs["max_tokens"] is not None:
        config_kwargs["max_output_tokens"] = kwargs["max_tokens"]

    generation_config = GenerateContentConfig(**config_kwargs)

    return contents, generation_config


# =============================================================================
# FIX 2: In _function_to_openai_tool(), add missing parameters field (BUG)
#
# WHY: This is an actual bug. The function builds a `parameters` dict from
#      the callable's signature and docstring, but never includes it in the
#      returned tool definition. The LLM receives tools with no parameter
#      schemas, so it doesn't know what arguments to pass.
#
#      Confirmed in OpenAI docs:
#      https://platform.openai.com/docs/guides/function-calling
#
#      The correct Chat Completions API tool format requires:
#      {
#          "type": "function",
#          "function": {
#              "name": "...",
#              "description": "...",
#              "parameters": { ... }   <-- THIS IS REQUIRED
#          }
#      }
#
# FIND THIS (at the end of _function_to_openai_tool):
#
#     return {
#         "type": "function",
#         "function": {
#             "name": func.__name__,
#             "description": func.__doc__ or "",
#         }
#     }
#
# REPLACE WITH:
# =============================================================================

def _fix2_function_to_openai_tool(func):
    """Shows the corrected _function_to_openai_tool with parameters included."""
    import inspect
    from docstring_parser import parse as parse_docstring

    docstring = parse_docstring(func.__doc__ or "")

    type_map = {
        "str": "string",
        "int": "integer",
        "float": "number",
        "bool": "boolean",
        "list": "array",
        "dict": "object",
    }

    properties = {}
    required = []

    sig = inspect.signature(func)
    for param_name, param in sig.parameters.items():
        if param.default is inspect.Parameter.empty:
            required.append(param_name)

    for param_info in docstring.params:
        param_name = param_info.arg_name
        param_type = "string"
        if param_name in func.__annotations__:
            annotation = func.__annotations__[param_name]
            type_name = getattr(annotation, "__name__", str(annotation)).lower()
            param_type = type_map.get(type_name, "string")
        properties[param_name] = {
            "type": param_type,
            "description": param_info.description or "",
        }

    parameters = {
        "type": "object",
        "properties": properties,
        "required": required,
    }

    return {
        "type": "function",
        "function": {
            "name": func.__name__,
            "description": docstring.short_description or func.__doc__ or "",
            "parameters": parameters,  # <-- THIS WAS MISSING
        },
    }


# =============================================================================
# TESTING
# =============================================================================

def test_fix1_system_instruction():
    """Verify system_instruction is accepted in GenerateContentConfig."""
    try:
        from google.genai.types import GenerateContentConfig
        config = GenerateContentConfig(
            temperature=0.7,
            system_instruction="You are a helpful assistant.",
        )
        assert config.system_instruction is not None
        print("PASS FIX 1: system_instruction accepted in config")
    except ImportError:
        print("SKIP FIX 1: google-genai not installed")
    except Exception as e:
        print(f"FAIL FIX 1: {e}")


def test_fix2_parameters():
    """Verify parameters are included in tool schema."""
    def add_numbers(a: int, b: int) -> int:
        """Add two numbers together.

        Args:
            a: First number
            b: Second number
        """
        return a + b

    schema = _fix2_function_to_openai_tool(add_numbers)
    func_def = schema["function"]

    assert "parameters" in func_def, "parameters key missing from function definition"
    assert "a" in func_def["parameters"]["properties"], "param 'a' missing"
    assert "b" in func_def["parameters"]["properties"], "param 'b' missing"
    assert func_def["parameters"]["properties"]["a"]["type"] == "integer"
    assert func_def["parameters"]["properties"]["b"]["type"] == "integer"
    assert set(func_def["parameters"]["required"]) == {"a", "b"}
    print("PASS FIX 2: parameters correctly included in tool schema")


if __name__ == "__main__":
    print("LLM Provider Fixes — Smoke Tests")
    print("=" * 40)
    test_fix1_system_instruction()
    test_fix2_parameters()
    print("=" * 40)
    print("Done. Fix 2 runs without SDK. Fix 1 requires google-genai.")
