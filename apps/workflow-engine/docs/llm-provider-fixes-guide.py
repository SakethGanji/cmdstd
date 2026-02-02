"""
LLM Provider Fixes Guide
=========================

This guide addresses correctness issues found by comparing the other system's
llm_provider.py against the official Google GenAI Python SDK documentation.

Fixes needed (4 spots):

    FIX 1: Function response role          — use "tool" instead of "user"
    FIX 2: System prompt handling           — use system_instruction instead of prepending
    FIX 3: Missing parameters in OpenAI tool schema (_function_to_openai_tool bug)
    FIX 4: (Bonus) Gemini auto-function-calling guard

Priority:
    FIX 3 is a BUG  — tool parameters are silently dropped, LLM can't call tools properly
    FIX 1 is correctness — works today but may break with future SDK updates
    FIX 2 is best practice — improves prompt quality
    FIX 4 is defensive — prevents unexpected behavior
"""


# =============================================================================
# FIX 1: In _convert_messages_to_gemini_content(), change function_response role
#
# WHY: The official Google GenAI docs specify role="tool" for function responses.
#      Your code uses role="user" which works because the SDK is lenient, but
#      it's not the documented contract and may break in future SDK versions.
#
# FIND THIS (inside the tool/function_response handling block):
#
#     contents.append(Content(
#         role="user",
#         parts=[Part.from_function_response(
#             name=tool_call_name,
#             response=tool_result_data
#         )]
#     ))
#
# REPLACE WITH:
# =============================================================================

def _fix1_example():
    """Shows the corrected function_response role."""
    from google.genai.types import Content, Part

    # Example values (these come from your message parsing loop)
    tool_call_name = "search_web"
    tool_result_data = {"result": "some data"}

    # --- OLD (works but incorrect role) ---
    # Content(role="user", parts=[Part.from_function_response(...)])

    # --- NEW (correct role per official docs) ---
    content = Content(
        role="tool",  # <-- changed from "user" to "tool"
        parts=[Part.from_function_response(
            name=tool_call_name,
            response=tool_result_data
        )]
    )
    return content


# =============================================================================
# FIX 2: In _call_gemini_vertex(), use system_instruction instead of prepending
#
# WHY: Your code extracts the system prompt and prepends it to the first user
#      message as "[System Instruction]\n{system}\n\n[User Message]\n{user}".
#      The official SDK has a dedicated system_instruction parameter in
#      GenerateContentConfig that gives Gemini a proper system-level context.
#      This produces better results because the model treats it as a system
#      instruction rather than user text.
#
# FIND THIS (near the top of _call_gemini_vertex):
#
#     system_prompt = None
#     gemini_contents = []
#     for msg in messages:
#         if msg.role == "system":
#             system_prompt = msg.content
#             continue
#         ...
#     # Then later, system_prompt is prepended to first user message:
#     if system_prompt and gemini_contents:
#         first = gemini_contents[0]
#         ...prepend logic...
#
# REPLACE WITH:
# =============================================================================

def _fix2_example(messages, tools, temperature, kwargs):
    """Shows system_instruction usage in GenerateContentConfig."""
    from google.genai.types import GenerateContentConfig

    # --- NEW: extract system prompt separately ---
    system_prompt = None
    gemini_contents = []

    for msg in messages:
        if msg.role == "system":
            system_prompt = msg.content
            continue
        # ... rest of your message conversion stays the same ...
        # (convert user/assistant/tool messages to Content objects)

    # --- NEW: pass system_instruction in config ---
    config_kwargs = {"temperature": temperature}

    if system_prompt:
        config_kwargs["system_instruction"] = system_prompt  # <-- official way

    if tools:
        config_kwargs["tools"] = tools  # already built elsewhere
    if "max_tokens" in kwargs and kwargs["max_tokens"] is not None:
        config_kwargs["max_output_tokens"] = kwargs["max_tokens"]

    generation_config = GenerateContentConfig(**config_kwargs)

    # --- DELETE: remove the old prepend-to-first-message logic entirely ---
    # No more "[System Instruction]\n..." concatenation needed.

    return gemini_contents, generation_config


# =============================================================================
# FIX 3: In _function_to_openai_tool(), add missing parameters field (BUG)
#
# WHY: This is an actual bug. The function builds a `parameters` dict from
#      the callable's signature and docstring, but never includes it in the
#      returned tool definition. The LLM receives tools with no parameter
#      schemas, so it doesn't know what arguments to pass.
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

def _fix3_function_to_openai_tool(func):
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
# FIX 4 (BONUS): Guard against Gemini auto-function-calling
#
# WHY: By default, the google-genai SDK can auto-execute function calls if
#      tools are passed as callables. Since your system manages the tool
#      execution loop itself, you want to disable automatic function calling
#      to prevent double-execution or unexpected behavior.
#
# ADD THIS to your GenerateContentConfig (only needed if you ever pass
# callables directly — if you switch to _tool_to_schema() per the
# integration guide, this is less critical but still good practice):
# =============================================================================

def _fix4_example(temperature, tools_config):
    """Shows how to disable automatic function calling."""
    from google.genai.types import GenerateContentConfig, AutomaticFunctionCallingConfig

    config = GenerateContentConfig(
        temperature=temperature,
        tools=tools_config,
        automatic_function_calling=AutomaticFunctionCallingConfig(
            disable=True  # <-- prevents SDK from auto-executing tools
        ),
    )
    return config


# =============================================================================
# TESTING: Verify fixes work
# =============================================================================

def test_fix1_role():
    """Verify the 'tool' role is accepted by the SDK."""
    try:
        from google.genai.types import Content, Part
        content = Content(
            role="tool",
            parts=[Part.from_function_response(
                name="test_func",
                response={"result": "ok"}
            )]
        )
        assert content.role == "tool"
        print("PASS FIX 1: role='tool' accepted by SDK")
    except ImportError:
        print("SKIP FIX 1: google-genai not installed")
    except Exception as e:
        print(f"FAIL FIX 1: {e}")


def test_fix2_system_instruction():
    """Verify system_instruction is accepted in GenerateContentConfig."""
    try:
        from google.genai.types import GenerateContentConfig
        config = GenerateContentConfig(
            temperature=0.7,
            system_instruction="You are a helpful assistant.",
        )
        assert config.system_instruction is not None
        print("PASS FIX 2: system_instruction accepted in config")
    except ImportError:
        print("SKIP FIX 2: google-genai not installed")
    except Exception as e:
        print(f"FAIL FIX 2: {e}")


def test_fix3_parameters():
    """Verify parameters are included in tool schema."""
    def add_numbers(a: int, b: int) -> int:
        """Add two numbers together.

        Args:
            a: First number
            b: Second number
        """
        return a + b

    schema = _fix3_function_to_openai_tool(add_numbers)
    func_def = schema["function"]

    assert "parameters" in func_def, "parameters key missing from function definition"
    assert "a" in func_def["parameters"]["properties"], "param 'a' missing"
    assert "b" in func_def["parameters"]["properties"], "param 'b' missing"
    assert func_def["parameters"]["properties"]["a"]["type"] == "integer"
    assert func_def["parameters"]["properties"]["b"]["type"] == "integer"
    assert set(func_def["parameters"]["required"]) == {"a", "b"}
    print("PASS FIX 3: parameters correctly included in tool schema")


def test_fix4_auto_calling():
    """Verify AutomaticFunctionCallingConfig is accepted."""
    try:
        from google.genai.types import GenerateContentConfig, AutomaticFunctionCallingConfig
        config = GenerateContentConfig(
            temperature=0.7,
            automatic_function_calling=AutomaticFunctionCallingConfig(disable=True),
        )
        print("PASS FIX 4: automatic_function_calling config accepted")
    except ImportError:
        print("SKIP FIX 4: google-genai not installed")
    except Exception as e:
        print(f"FAIL FIX 4: {e}")


if __name__ == "__main__":
    print("LLM Provider Fixes — Smoke Tests")
    print("=" * 40)
    test_fix1_role()
    test_fix2_system_instruction()
    test_fix3_parameters()
    test_fix4_auto_calling()
    print("=" * 40)
    print("Done. Fix 3 runs without SDK. Fixes 1/2/4 require google-genai.")
