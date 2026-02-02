"""
LLM Provider Integration Guide
===============================

Problem:
    The other system's call_llm only accepts Python callables as tools.
    The workflow-engine passes tools as dicts: {"name": ..., "description": ..., "input_schema": ...}
    We need both formats to work.

Changes needed (3 spots in the other system's llm provider script):

    1. Add _tool_to_schema() function       — bridge that normalizes both formats
    2. Update _call_gemini_vertex()          — use the bridge instead of _function_to_gemini_tool()
    3. Update _call_llama_openai_proxy()     — use the bridge instead of _function_to_openai_tool()

No changes needed to: call_llm(), LLMResponse, data classes, client manager, model registries.
Existing code that passes callables will keep working — this is backwards compatible.
"""

# =============================================================================
# CHANGE 1: Add this function anywhere above _call_gemini_vertex
#
# WHY: The existing _function_to_gemini_tool() and _function_to_openai_tool()
#      only handle callables. This function normalizes both callables AND dicts
#      into a common {name, description, parameters} schema dict, so the
#      backends don't need to care what format they received.
# =============================================================================

def _tool_to_schema(tool) -> dict:
    """Convert a tool (callable or dict) to a unified schema dict.

    Accepts:
        - dict with keys: name, description, parameters OR input_schema
        - callable with docstring (uses existing _function_to_gemini_tool logic)

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
# CHANGE 2: In _call_gemini_vertex(), replace the tools construction block
#
# WHY: The old code does:
#     gemini_tools = [_function_to_gemini_tool(f) for f in tools]
#   which crashes if tools contains dicts. The new code routes through
#   _tool_to_schema() first, then builds FunctionDeclarations from the
#   normalized schema.
#
# FIND THIS LINE:
#     gemini_tools = [_function_to_gemini_tool(f) for f in tools] if tools else None
#
#     config_kwargs = {"temperature": temperature, "tools": gemini_tools}
#     if "max_tokens" in kwargs and kwargs["max_tokens"] is not None:
#         config_kwargs["max_output_tokens"] = kwargs["max_tokens"]
#     generation_config = GenerateContentConfig(**config_kwargs)
#
# REPLACE WITH:
# =============================================================================

def _example_gemini_tools_block(tools, temperature, kwargs):
    """This shows the replacement code for _call_gemini_vertex."""
    from google.genai.types import GenerateContentConfig, FunctionDeclaration, Tool

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

    # --- NEW: only add tools to config if present ---
    config_kwargs = {"temperature": temperature}
    if gemini_tools:
        config_kwargs["tools"] = gemini_tools
    if "max_tokens" in kwargs and kwargs["max_tokens"] is not None:
        config_kwargs["max_output_tokens"] = kwargs["max_tokens"]
    generation_config = GenerateContentConfig(**config_kwargs)

    return generation_config


# =============================================================================
# CHANGE 3: In _call_llama_openai_proxy(), replace the tools construction block
#
# WHY: Same reason — the old code does:
#     api_tools = [_function_to_openai_tool(f) for f in tools]
#   which crashes on dicts. The new code normalizes via _tool_to_schema()
#   and builds the OpenAI tool format from the schema.
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
