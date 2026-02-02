"""
LLM Provider Integration Guide
===============================

Apply these changes to the other system's llm_provider.py so that call_llm
accepts both Python callables AND dicts as tools (the workflow-engine passes
dicts with {name, description, input_schema}).

Changes needed (4 spots):

    1. Add _tool_to_schema()              — normalizes callables and dicts to a common schema
    2. Fix _convert_messages_to_gemini_content() — return system_instruction separately
    3. Update _call_gemini_vertex()        — use _tool_to_schema + system_instruction in config
    4. Update _call_llama_openai_proxy()   — use _tool_to_schema (also fixes missing parameters bug)

No changes needed to: call_llm(), LLMResponse, data classes, client manager, model registries.
Existing code that passes callables will keep working — this is backwards compatible.

NOTE: The old _function_to_openai_tool() has a bug where `parameters` is built but
never returned in the dict. CHANGE 4 replaces it entirely, so no separate fix needed.
"""


# =============================================================================
# CHANGE 1: Add this function anywhere above _call_gemini_vertex
#
# WHY: The existing _function_to_gemini_tool() and _function_to_openai_tool()
#      only handle callables. This function normalizes both callables AND dicts
#      into a common {name, description, parameters} schema dict, so the
#      backends don't need to care what format they received.
#
# Also replaces _function_to_gemini_tool() and _function_to_openai_tool() —
# you can delete both after applying all changes.
# =============================================================================

def _tool_to_schema(tool) -> dict:
    """Convert a tool (callable or dict) to a unified schema dict.

    Accepts:
        - dict with keys: name, description, parameters OR input_schema
        - callable with docstring (uses existing docstring parsing logic)

    Returns:
        {"name": str, "description": str, "parameters": dict}
    """
    if isinstance(tool, dict):
        return {
            "name": tool["name"],
            "description": tool.get("description", ""),
            "parameters": (
                tool.get("parameters")
                or tool.get("input_schema")
                or {}
            ),
        }
    if callable(tool):
        # Reuse existing docstring parsing logic
        from docstring_parser import parse as parse_docstring
        import inspect

        docstring = parse_docstring(tool.__doc__ or "")
        type_map = {
            "str": "STRING", "int": "INTEGER",
            "float": "NUMBER", "bool": "BOOLEAN",
        }

        properties = {}
        required = []

        sig = inspect.signature(tool)
        for param_name, param in sig.parameters.items():
            if param.default is inspect.Parameter.empty:
                required.append(param_name)

        for param_info in docstring.params:
            param_name = param_info.arg_name
            param_type = "STRING"
            if param_name in tool.__annotations__:
                type_name = (
                    str(tool.__annotations__[param_name])
                    .split("[")[0].split(".")[0].split("|")[-1].lower()
                )
                param_type = type_map.get(type_name, "STRING")
            properties[param_name] = {
                "type": param_type,
                "description": param_info.description or "",
            }

        return {
            "name": tool.__name__,
            "description": docstring.short_description or "",
            "parameters": {
                "type": "OBJECT",
                "properties": properties,
                "required": required,
            },
        }

    raise TypeError(f"Tool must be a callable or dict, got {type(tool)}")


# =============================================================================
# CHANGE 2: Fix _convert_messages_to_gemini_content() to return system_instruction
#
# WHY: The current code prepends the system prompt to the first user message:
#         content = f"{system_prompt}\n\n{content}"
#      The SDK has a dedicated system_instruction parameter in
#      GenerateContentConfig that gives Gemini proper system-level context.
#      This produces better results because the model treats it as a system
#      instruction rather than user text.
#
# VERIFIED — from official google-genai SDK docs (googleapis.github.io/python-genai):
#
#     response = client.models.generate_content(
#         model='gemini-2.0-flash-001',
#         contents='high',
#         config=types.GenerateContentConfig(
#             system_instruction='I say high, you say low',
#             max_output_tokens=3,
#             temperature=0.3,
#         ),
#     )
#
# system_instruction also accepts a list of strings:
#
#     config=GenerateContentConfig(
#         system_instruction=[
#             "You're a language translator.",
#             "Your mission is to translate text in English to French.",
#         ]
#     )
#
# FIND THIS:
#     def _convert_messages_to_gemini_content(messages: List[Dict[str, Any]]) -> List[Content]:
#
# REPLACE WITH (note: return type changes to a tuple):
# =============================================================================

def _convert_messages_to_gemini_content(messages):
    """Returns (contents, system_instruction) instead of just contents."""
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

    return contents, system_instruction  # <-- tuple now


# =============================================================================
# CHANGE 3: In _call_gemini_vertex(), replace the tools + config block
#
# WHY: Two things change here:
#   a) Tools are built via _tool_to_schema() instead of _function_to_gemini_tool()
#      so both callables and dicts work.
#   b) system_instruction is passed in the config instead of being prepended
#      (depends on CHANGE 2 above).
#
# VERIFIED — from official Gemini function calling docs (ai.google.dev):
#
# FunctionDeclarations are wrapped in a Tool object:
#
#     function = types.FunctionDeclaration(
#         name='get_current_weather',
#         description='Get the current weather in a given location',
#         parameters={...},
#     )
#     tool = types.Tool(function_declarations=[function])
#
#     response = client.models.generate_content(
#         model='gemini-2.5-flash',
#         contents='What is the weather like in Boston?',
#         config=types.GenerateContentConfig(tools=[tool]),
#     )
#
# Function responses use role="user" per the primary official example:
#
#     contents.append(types.Content(role="user", parts=[function_response_part]))
#
# FIND THIS:
#     contents = _convert_messages_to_gemini_content(messages)
#     gemini_tools = [_function_to_gemini_tool(f) for f in tools] if tools else None
#
#     config_kwargs = {"temperature": temperature, "tools": gemini_tools}
#     if "max_tokens" in kwargs and kwargs["max_tokens"] is not None:
#         config_kwargs["max_output_tokens"] = kwargs["max_tokens"]
#     generation_config = GenerateContentConfig(**config_kwargs)
#
# REPLACE WITH:
# =============================================================================

def _example_gemini_call(messages, tools, temperature, kwargs):
    """This shows the replacement block inside _call_gemini_vertex."""
    from google.genai.types import GenerateContentConfig, FunctionDeclaration, Tool

    # --- NEW: unpack system_instruction from the tuple ---
    contents, system_instruction = _convert_messages_to_gemini_content(messages)

    # --- NEW: build tools via _tool_to_schema ---
    gemini_tools = None
    if tools:
        declarations = []
        for t in tools:
            schema = _tool_to_schema(t)
            declarations.append(FunctionDeclaration(
                name=schema["name"],
                description=schema["description"],
                parameters=schema["parameters"] or {"type": "OBJECT", "properties": {}},
            ))
        gemini_tools = [Tool(function_declarations=declarations)]

    # --- NEW: only add tools/system_instruction to config if present ---
    config_kwargs = {"temperature": temperature}
    if gemini_tools:
        config_kwargs["tools"] = gemini_tools
    if system_instruction:
        config_kwargs["system_instruction"] = system_instruction
    if "max_tokens" in kwargs and kwargs["max_tokens"] is not None:
        config_kwargs["max_output_tokens"] = kwargs["max_tokens"]
    generation_config = GenerateContentConfig(**config_kwargs)

    return contents, generation_config


# =============================================================================
# CHANGE 4: In _call_llama_openai_proxy(), replace the tools construction block
#
# WHY: The old code does:
#     api_tools = [_function_to_openai_tool(f) for f in tools]
#   which crashes on dicts. Also, _function_to_openai_tool() has a bug where
#   it builds `parameters` but never includes it in the return dict — the LLM
#   receives tools with no parameter schemas.
#
#   The new code routes through _tool_to_schema() which fixes both issues.
#
# VERIFIED — from OpenAI Chat Completions API docs:
#
# The correct tool format requires "parameters" inside "function":
#
#     tools = [{
#         "type": "function",
#         "function": {
#             "name": "get_weather",
#             "description": "Get current temperature for a given location.",
#             "parameters": {
#                 "type": "object",
#                 "properties": {
#                     "location": {
#                         "type": "string",
#                         "description": "City and country e.g. Bogota, Colombia"
#                     }
#                 },
#                 "required": ["location"]
#             }
#         }
#     }]
#
# THE BUG — the old _function_to_openai_tool() returns this (parameters missing):
#
#     return {
#         "type": "function",
#         "function": {
#             "name": func.__name__,
#             "description": docstring.short_description
#         }
#     }
#     # ^^ parameters dict is built above but never included here
#
# FIND THIS LINE:
#     api_tools = [_function_to_openai_tool(f) for f in tools] if tools else None
#
# REPLACE WITH:
# =============================================================================

def _example_llama_tools_block(tools):
    """This shows the replacement code for _call_llama_openai_proxy."""

    # --- NEW: build tools via _tool_to_schema ---
    api_tools = None
    if tools:
        api_tools = []
        for t in tools:
            schema = _tool_to_schema(t)
            params = schema["parameters"] or {"type": "object", "properties": {}}
            # Normalize type casing: Gemini uses OBJECT, OpenAI uses object
            if isinstance(params.get("type"), str):
                params["type"] = params["type"].lower()
            api_tools.append({
                "type": "function",
                "function": {
                    "name": schema["name"],
                    "description": schema["description"],
                    "parameters": params,
                },
            })

    return api_tools


# =============================================================================
# CLEANUP: After applying all changes, delete these functions:
#   - _function_to_gemini_tool()    (replaced by _tool_to_schema + CHANGE 3)
#   - _function_to_openai_tool()    (replaced by _tool_to_schema + CHANGE 4)
# =============================================================================


# =============================================================================
# TESTING: After integration, verify both formats work
# =============================================================================

def _test_tool_to_schema():
    """Quick smoke test — run this after integrating to verify both formats."""

    # Test 1: Dict format (how workflow-engine passes tools)
    dict_tool = {
        "name": "http_request",
        "description": "Make an HTTP request",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "The URL"},
            },
            "required": ["url"],
        },
    }
    schema = _tool_to_schema(dict_tool)
    assert schema["name"] == "http_request"
    assert schema["parameters"]["required"] == ["url"]
    print("PASS: dict tool")

    # Test 2: Callable format (how the other system currently passes tools)
    def search_web(query: str) -> str:
        """Search the web for information.

        Args:
            query: The search query string
        """
        return "results"

    schema = _tool_to_schema(search_web)
    assert schema["name"] == "search_web"
    assert "query" in schema["parameters"]["properties"]
    print("PASS: callable tool")

    print("\nAll tests passed. Both tool formats work correctly.")


if __name__ == "__main__":
    _test_tool_to_schema()
