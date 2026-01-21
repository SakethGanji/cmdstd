# Proposal: Workflow Input Schema & Node Registry Refactor

## Problem

Currently, workflows accept arbitrary input data via webhooks or manual runs with no validation:

```bash
POST /webhook/{workflow_id}
{"anything": "goes"}  # No validation, fails deep in execution with unclear errors
```

This leads to:
- Confusing runtime errors when inputs are wrong
- No documentation of what a workflow expects
- No type safety or coercion
- Callers must read workflow internals to understand the API

## Proposed Solution

Add an optional `inputs` field to workflow definitions that declares expected inputs with types, validation, and defaults.

### Workflow Definition Change

```json
{
  "name": "Process Order",
  "description": "Processes an incoming order",
  "inputs": [
    {
      "name": "order_id",
      "type": "string",
      "required": true,
      "description": "The order ID to process"
    },
    {
      "name": "priority",
      "type": "string",
      "required": false,
      "default": "normal",
      "options": ["low", "normal", "high"],
      "description": "Processing priority"
    },
    {
      "name": "line_items",
      "type": "array",
      "required": true,
      "description": "List of items in the order"
    },
    {
      "name": "express_shipping",
      "type": "boolean",
      "required": false,
      "default": false
    },
    {
      "name": "metadata",
      "type": "object",
      "required": false,
      "default": {}
    }
  ],
  "nodes": [...],
  "connections": [...]
}
```

### Input Types

| Type | Description | Coercion |
|------|-------------|----------|
| `string` | Text value | Numbers/bools converted to string |
| `number` | Integer or float | String "123" → 123 |
| `integer` | Integer only | String "123" → 123, rejects "12.5" |
| `boolean` | true/false | "true"/"false"/1/0 accepted |
| `array` | JSON array | None |
| `object` | JSON object | None |
| `any` | No type checking | None |

### Validation Rules

- `required`: Input must be present (after defaults applied)
- `default`: Value used when input not provided
- `options`: Array of allowed values (enum)
- `min`/`max`: For numbers - value range
- `minLength`/`maxLength`: For strings/arrays - length constraints
- `pattern`: For strings - regex pattern

## API Changes

### 1. Webhook Validation

```bash
# Request with missing required field
POST /webhook/{workflow_id}
{"priority": "high"}

# Response: 400 Bad Request
{
  "error": "Input validation failed",
  "details": [
    {"field": "order_id", "message": "Required input missing"},
    {"field": "line_items", "message": "Required input missing"}
  ]
}
```

```bash
# Request with invalid type
POST /webhook/{workflow_id}
{"order_id": "123", "line_items": "not-an-array"}

# Response: 400 Bad Request
{
  "error": "Input validation failed",
  "details": [
    {"field": "line_items", "message": "Expected array, got string"}
  ]
}
```

```bash
# Request with invalid option
POST /webhook/{workflow_id}
{"order_id": "123", "line_items": [], "priority": "ultra"}

# Response: 400 Bad Request
{
  "error": "Input validation failed",
  "details": [
    {"field": "priority", "message": "Value must be one of: low, normal, high"}
  ]
}
```

### 2. Schema Discovery Endpoint

New endpoint to retrieve workflow input schema:

```bash
GET /webhook/{workflow_id}/schema

# Response: 200 OK
{
  "workflow_id": "abc123",
  "workflow_name": "Process Order",
  "inputs": [
    {
      "name": "order_id",
      "type": "string",
      "required": true,
      "description": "The order ID to process"
    },
    {
      "name": "priority",
      "type": "string",
      "required": false,
      "default": "normal",
      "options": ["low", "normal", "high"]
    }
  ],
  "example_request": {
    "order_id": "ORD-123",
    "priority": "normal",
    "line_items": [],
    "express_shipping": false,
    "metadata": {}
  }
}
```

### 3. Manual Run Validation

Same validation applies to manual runs:

```bash
POST /api/workflows/{workflow_id}/run
{
  "input_data": {
    "order_id": "123"
    # missing line_items
  }
}

# Response: 400 Bad Request
{
  "error": "Input validation failed",
  "details": [
    {"field": "line_items", "message": "Required input missing"}
  ]
}
```

### 4. Accessing Inputs in Nodes

Validated inputs available via `$inputs` in expressions:

```javascript
// In any node parameter
$inputs.order_id        // "ORD-123"
$inputs.priority        // "normal" (or default)
$inputs.line_items      // [...]
$inputs.express_shipping // false (default applied)

// Full inputs object
$inputs                 // { order_id: "...", priority: "...", ... }
```

For backward compatibility, webhook data still available via existing methods:
- `$json.body` - raw request body
- `$json.headers` - request headers
- `$json.query` - query parameters

## Files to Change

### Schema Changes

**`src/schemas/workflow.py`**
```python
# Add new schema
class WorkflowInputDefinition(BaseModel):
    name: str
    type: Literal["string", "number", "integer", "boolean", "array", "object", "any"]
    required: bool = False
    default: Any = None
    description: str | None = None
    options: list[Any] | None = None  # enum values
    min: float | None = None
    max: float | None = None
    min_length: int | None = None
    max_length: int | None = None
    pattern: str | None = None

# Update WorkflowCreateRequest
class WorkflowCreateRequest(BaseModel):
    name: str
    description: str | None = None
    inputs: list[WorkflowInputDefinition] = []  # <-- ADD THIS
    nodes: list[NodeDefinitionSchema]
    connections: list[ConnectionSchema] = []
    settings: dict = {}
```

**`src/schemas/webhook.py`** (new file)
```python
class WebhookSchemaResponse(BaseModel):
    workflow_id: str
    workflow_name: str
    inputs: list[WorkflowInputDefinition]
    example_request: dict

class InputValidationError(BaseModel):
    field: str
    message: str

class InputValidationErrorResponse(BaseModel):
    error: str = "Input validation failed"
    details: list[InputValidationError]
```

### Validation Logic

**`src/services/input_validator.py`** (new file)
```python
class InputValidator:
    """Validates and coerces input data against workflow input schema."""

    def validate(
        self,
        input_data: dict,
        schema: list[WorkflowInputDefinition]
    ) -> tuple[dict, list[InputValidationError]]:
        """
        Returns (validated_data, errors).
        - Applies defaults
        - Coerces types
        - Validates constraints
        """
        pass

    def _coerce_type(self, value: Any, target_type: str) -> Any:
        """Attempt to coerce value to target type."""
        pass

    def _validate_constraints(
        self,
        name: str,
        value: Any,
        definition: WorkflowInputDefinition
    ) -> list[InputValidationError]:
        """Check min/max, options, pattern, etc."""
        pass
```

### Route Changes

**`src/routes/webhooks.py`**
```python
# Add schema endpoint
@router.get("/webhook/{workflow_id}/schema")
async def get_webhook_schema(workflow_id: str, ...):
    """Return input schema for workflow webhook."""
    pass

# Update webhook handler to validate inputs
@router.api_route("/webhook/{workflow_id}", methods=["GET", "POST", "PUT", "DELETE"])
async def handle_webhook(workflow_id: str, request: Request, ...):
    # Get workflow
    # If workflow.inputs defined:
    #   - Extract input_data from body/query
    #   - Validate against schema
    #   - Return 400 if validation fails
    # Execute workflow with validated inputs
    pass
```

**`src/routes/workflows.py`**
```python
# Update run endpoint to validate inputs
@router.post("/workflows/{workflow_id}/run")
async def run_workflow(workflow_id: str, request: RunWorkflowRequest, ...):
    # Get workflow
    # If workflow.inputs defined:
    #   - Validate request.input_data against schema
    #   - Return 400 if validation fails
    # Execute workflow
    pass
```

### Engine Changes

**`src/engine/workflow_runner.py`**
```python
# Add validated inputs to execution context
class WorkflowRunner:
    async def run(
        self,
        workflow: WorkflowDefinition,
        trigger_data: dict | None = None,
        validated_inputs: dict | None = None,  # <-- ADD THIS
        ...
    ):
        # Make validated_inputs available in context
        pass
```

**`src/engine/expression_engine.py`**
```python
# Add $inputs to expression context
def build_context(self, ...):
    return {
        "$json": ...,
        "$node": ...,
        "$inputs": validated_inputs,  # <-- ADD THIS
        "$executionId": ...,
    }
```

### Database Changes

None required - inputs schema stored in existing `definition` JSON field.

## Migration / Backward Compatibility

- `inputs` field is optional - existing workflows continue to work
- Workflows without `inputs` skip validation entirely
- `$json.body` still works for raw webhook data access
- No database migration needed

## Example: Complete Workflow with Inputs

```json
{
  "name": "Send Notification",
  "description": "Sends a notification to a user",
  "inputs": [
    {
      "name": "user_id",
      "type": "string",
      "required": true,
      "description": "User to notify"
    },
    {
      "name": "message",
      "type": "string",
      "required": true,
      "min_length": 1,
      "max_length": 1000
    },
    {
      "name": "channel",
      "type": "string",
      "required": false,
      "default": "email",
      "options": ["email", "sms", "push"]
    },
    {
      "name": "priority",
      "type": "integer",
      "required": false,
      "default": 5,
      "min": 1,
      "max": 10
    }
  ],
  "nodes": [
    {
      "name": "trigger",
      "type": "Webhook",
      "parameters": {},
      "position": {"x": 0, "y": 0}
    },
    {
      "name": "send",
      "type": "HttpRequest",
      "parameters": {
        "url": "https://api.notify.com/send",
        "method": "POST",
        "body": {
          "to": "$inputs.user_id",
          "message": "$inputs.message",
          "channel": "$inputs.channel",
          "priority": "$inputs.priority"
        }
      },
      "position": {"x": 200, "y": 0}
    }
  ],
  "connections": [
    {"source_node": "trigger", "target_node": "send"}
  ]
}
```

Usage:
```bash
# Valid request
curl -X POST http://localhost:8000/webhook/notif-123 \
  -H "Content-Type: application/json" \
  -d '{"user_id": "u_456", "message": "Hello!", "channel": "sms"}'

# Check schema
curl http://localhost:8000/webhook/notif-123/schema
```

---

# Part 2: Node Registry Refactor

## Problem

The current node registry requires manually listing every node class twice:

```python
# node_registry.py - current state
def register_all_nodes():
    from ..nodes import (
        StartNode,
        WebhookNode,
        CronNode,
        # ... 30+ more imports
    )

    all_node_classes = [
        StartNode,
        WebhookNode,
        CronNode,
        # ... same 30+ classes again
    ]

    for node_class in all_node_classes:
        node_registry.register(node_class)
```

This leads to:
- Duplicate maintenance (import + list)
- Easy to forget adding new nodes
- Error-prone updates
- Unnecessary boilerplate

## Proposed Solution: Decorator-Based Registration

Use a `@register_node` decorator that auto-registers node classes when imported.

### The Decorator

**`src/nodes/base.py`** - add decorator:
```python
from typing import TypeVar, Type

T = TypeVar('T', bound='BaseNode')

def register_node(cls: Type[T]) -> Type[T]:
    """
    Decorator to register a node class with the registry.

    Usage:
        @register_node
        class MyNode(BaseNode):
            ...
    """
    # Import here to avoid circular imports
    from ..engine.node_registry import node_registry
    node_registry.register(cls)
    return cls
```

### Usage in Node Files

**Before:**
```python
# nodes/http_request.py
class HttpRequestNode(BaseNode):
    type = "HttpRequest"
    ...
```

**After:**
```python
# nodes/http_request.py
from .base import BaseNode, register_node

@register_node
class HttpRequestNode(BaseNode):
    type = "HttpRequest"
    ...
```

### Simplified Registry

**`src/engine/node_registry.py`** - remove manual registration:
```python
class NodeRegistryClass:
    """Registry for workflow node types."""

    def __init__(self) -> None:
        self._nodes: dict[str, type[BaseNode]] = {}
        self._instances: dict[str, BaseNode] = {}

    def register(self, node_class: type[BaseNode]) -> None:
        """Register a node class."""
        instance = node_class()
        if instance.type not in self._nodes:
            self._nodes[instance.type] = node_class
            self._instances[instance.type] = instance

    def get(self, node_type: str) -> BaseNode:
        """Get a cached node instance by type."""
        if node_type not in self._instances:
            raise ValueError(f'Unknown node type: "{node_type}"')
        return self._instances[node_type]

    # ... rest of methods unchanged ...

# Singleton instance
node_registry = NodeRegistryClass()


def register_all_nodes() -> None:
    """
    Import all node modules to trigger @register_node decorators.

    This replaces the manual registration list.
    """
    # Regular nodes
    from ..nodes import (  # noqa: F401
        start,
        webhook,
        cron,
        error_trigger,
        execute_workflow_trigger,
        if_node,
        switch,
        merge,
        wait,
        split_in_batches,
        execute_workflow,
        stop_and_error,
        set_node,
        http_request,
        code,
        read_file,
        write_file,
        pandas_explore,
        html_display,
        object_read,
        object_write,
        filter_node,
        item_lists,
        respond_to_webhook,
        llm_chat,
        ai_agent,
        chat_input,
        chat_output,
    )

    # Subnodes
    from ..nodes.subnodes import (  # noqa: F401
        gemini_model,
        simple_memory,
        calculator_tool,
        current_time_tool,
        random_number_tool,
        text_tool,
    )
```

### Alternative: Full Auto-Discovery (Optional)

If you want zero imports at all, use `pkgutil` to auto-discover:

```python
def register_all_nodes() -> None:
    """Auto-discover and import all node modules."""
    import importlib
    import pkgutil
    from pathlib import Path

    # Import nodes package
    from .. import nodes
    nodes_path = Path(nodes.__file__).parent

    # Walk all modules in nodes/
    for module_info in pkgutil.walk_packages([str(nodes_path)], prefix="nodes."):
        if not module_info.name.startswith("nodes.base"):
            importlib.import_module(f"..{module_info.name}", __name__)
```

**Trade-off:** More magical, harder to debug if imports fail silently.

## Files to Change

| File | Change |
|------|--------|
| `src/nodes/base.py` | Add `@register_node` decorator |
| `src/engine/node_registry.py` | Remove manual class list, keep module imports |
| `src/nodes/start.py` | Add `@register_node` decorator |
| `src/nodes/webhook.py` | Add `@register_node` decorator |
| `src/nodes/cron.py` | Add `@register_node` decorator |
| ... (all node files) | Add `@register_node` decorator |
| `src/nodes/subnodes/*.py` | Add `@register_node` decorator |

## Example: Full Node File After Refactor

```python
# src/nodes/http_request.py
from __future__ import annotations

import httpx
from typing import Any

from .base import BaseNode, register_node, NodeTypeDescription, NodeProperty


@register_node
class HttpRequestNode(BaseNode):
    """Make HTTP requests to external APIs."""

    type = "HttpRequest"
    description = "Make HTTP requests"

    node_description = NodeTypeDescription(
        display_name="HTTP Request",
        description="Make HTTP requests to external APIs",
        icon="globe",
        group=["Transform"],
        properties=[
            NodeProperty(
                name="url",
                display_name="URL",
                type="string",
                required=True,
                placeholder="https://api.example.com/endpoint",
            ),
            NodeProperty(
                name="method",
                display_name="Method",
                type="options",
                default="GET",
                options=[...],
            ),
            # ... rest of properties
        ],
    )

    async def execute(self, input_data: list[dict], parameters: dict, context: Any) -> dict:
        # ... implementation
        pass
```

## Benefits

1. **Single source of truth** - Node is registered where it's defined
2. **No duplicate lists** - Add decorator once, done
3. **Self-documenting** - `@register_node` clearly marks registered nodes
4. **Easy to add nodes** - Create file, add decorator, it works
5. **Easy to exclude** - No decorator = not registered (useful for base classes, tests)
6. **Debuggable** - Missing node? Check for decorator

## Migration Steps

1. Add `@register_node` decorator to `src/nodes/base.py`
2. Update each node file to use the decorator (can be scripted)
3. Simplify `register_all_nodes()` to just import modules
4. Test that all nodes still appear in `GET /api/nodes`

---

# Combined Summary

| Component | Change |
|-----------|--------|
| **Input Schema** | |
| Schema | Add `WorkflowInputDefinition`, update `WorkflowCreateRequest` |
| New file | `src/services/input_validator.py` |
| New file | `src/schemas/webhook.py` |
| Routes | Add validation to webhook + run endpoints, add schema endpoint |
| Engine | Pass `$inputs` to expression context |
| **Node Registry** | |
| `src/nodes/base.py` | Add `@register_node` decorator |
| `src/engine/node_registry.py` | Remove manual class list |
| All node files | Add `@register_node` decorator |
| **Database** | None |
| **Breaking changes** | None |
