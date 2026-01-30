# Workflow Engine API Reference

## Base URL

All `/api/*` routes are served under the main API router. Webhook and streaming routes are mounted at the root.

---

## Workflows

CRUD operations for workflow definitions.

### `GET /api/workflows`

List all workflows.

**Response:** `WorkflowListItem[]`

### `GET /api/workflows/{workflow_id}`

Get a single workflow by ID.

**Response:** `WorkflowDetailResponse` | `404`

### `POST /api/workflows`

Create a new workflow.

**Body:** `WorkflowCreateRequest` — name, description, nodes, connections, settings.

**Response:** `201 WorkflowResponse` | `400`

### `PUT /api/workflows/{workflow_id}`

Update an existing workflow definition.

**Body:** `WorkflowUpdateRequest`

**Response:** `WorkflowDetailResponse` | `404` | `400`

### `DELETE /api/workflows/{workflow_id}`

Delete a workflow.

**Response:** `SuccessResponse` | `404`

### `PATCH /api/workflows/{workflow_id}/active`

Toggle a workflow's active state (enables/disables webhook triggers).

**Body:** `ActiveToggleRequest` — `{ active: boolean }`

**Response:** `WorkflowActiveResponse` | `404`

### `POST /api/workflows/{workflow_id}/run`

Execute a saved workflow.

**Body (optional):** `RunWorkflowRequest` — `{ input_data: object }`

**Response:** `ExecutionResponse` | `404` | `400`

### `POST /api/workflows/run-adhoc`

Execute a workflow definition without saving it.

**Body:** `WorkflowCreateRequest`

**Response:** `ExecutionResponse` | `400`

---

## Executions

Execution history and records.

### `GET /api/executions`

List execution records.

**Query:** `workflow_id` (optional) — filter by workflow.

**Response:** `ExecutionListItem[]`

### `GET /api/executions/{execution_id}`

Get full execution details including node outputs and errors.

**Response:** `ExecutionDetailResponse` | `404`

### `DELETE /api/executions/{execution_id}`

Delete a single execution record.

**Response:** `SuccessResponse` | `404`

### `DELETE /api/executions`

Clear all execution records.

**Response:** `SuccessResponse` with count of deleted records.

---

## Nodes

Node type registry and schema discovery.

### `GET /api/nodes`

List all available node types with their full schemas (properties, inputs, outputs).

**Query:** `group` (optional) — filter by group (e.g. `flow`, `transform`, `trigger`, `ai`).

**Response:** `NodeTypeInfo[]`

### `GET /api/nodes/{node_type}`

Get the full schema for a specific node type.

**Response:** `NodeTypeInfo` | `404`

---

## Files

File system browser for file-based nodes (ReadFile, WriteFile).

### `GET /api/files/browse`

Browse files and directories.

**Query:**
- `path` (default `~`) — directory path to browse.
- `filter_extensions` (optional) — comma-separated extensions to filter by (e.g. `.csv,.parquet`).

Hidden files are excluded.

**Response:** `BrowseResponse` — `{ current_path, parent_path, entries: FileEntry[] }` | `404` | `400` | `403`

### `GET /api/files/validate`

Validate that a file path exists and optionally matches allowed extensions.

**Query:**
- `path` (required) — file path to validate.
- `extensions` (optional) — comma-separated allowed extensions.

**Response:** `{ valid, path, name, size, extension }` or `{ valid: false, error }`

---

## AI Chat

AI-powered workflow assistant using Google ADK + Gemini.

### `POST /api/ai/chat`

Stream an AI chat response as Server-Sent Events. The AI agent can inspect, create, modify, validate, and execute workflows using tool calls.

**Body:**

```json
{
  "message": "Create a workflow that fetches users from an API",
  "session_id": "session_abc123",
  "workflow_context": {
    "name": "My Workflow",
    "nodes": [{ "name": "Start", "type": "Start", "parameters": {} }],
    "connections": []
  },
  "conversation_history": [
    { "role": "user", "content": "previous message" },
    { "role": "assistant", "content": "previous response" }
  ],
  "mode_hint": "auto"
}
```

- `session_id` (optional) — stable session ID for multi-turn context. If omitted, a new session is created per request.
- `workflow_context` (optional) — current canvas state.
- `conversation_history` — prior messages for context.
- `mode_hint` — one of `auto`, `generate`, `modify`, `explain`, `fix`.

**SSE Events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `text` | `{ type: "text", content: "..." }` | Agent's text response |
| `operations` | `{ type: "operations", payload: { mode, ... } }` | Workflow mutations to apply to the canvas |
| `error` | `{ type: "error", message: "..." }` | Error during agent execution |
| `done` | `{ type: "done" }` | Stream complete |

**Operations payload modes:**

- `full_workflow` — complete workflow replacement with `{ name, nodes, connections }`
- `incremental` — list of operations: `addNode`, `updateNode`, `removeNode`, `addConnection`, `removeConnection`

---

## Execution Streaming

Real-time workflow execution via Server-Sent Events.

### `POST /execution-stream/adhoc`

Stream an ad-hoc workflow execution.

**Body:**

```json
{
  "name": "My Workflow",
  "nodes": [...],
  "connections": [...],
  "settings": {},
  "input_data": {}
}
```

If `input_data` is provided, runs in webhook mode; otherwise manual mode.

**SSE Events:** JSON objects with `type`, `executionId`, `timestamp`, `nodeName`, `nodeType`, `data`, `error`, `progress`, and subworkflow info.

### `GET /execution-stream/{workflow_id}`

Stream execution of a saved workflow (no input data, manual mode).

**Response:** SSE stream | `404` | `400`

### `POST /execution-stream/{workflow_id}`

Stream execution of a saved workflow with optional test input.

**Body:** `{ input_data: object }` (optional)

**Response:** SSE stream | `404` | `400`

---

## Webhooks

HTTP triggers for workflows. All methods extract body, headers, and query parameters and pass them to the workflow's Webhook node.

Workflows must be set to `active: true` to accept webhook triggers.

### `POST /webhook/{workflow_id}`

Trigger a workflow via POST. Supports JSON and multipart/form-data (with file uploads — files are base64-encoded).

### `GET /webhook/{workflow_id}`

Trigger a workflow via GET. Query parameters and headers are passed as input.

### `PUT /webhook/{workflow_id}`

Trigger a workflow via PUT.

### `DELETE /webhook/{workflow_id}`

Trigger a workflow via DELETE.

**Response for all methods:** If the workflow contains a `RespondToWebhook` node, returns a custom response (status code, headers, body). Otherwise returns the execution result as JSON. Returns `404` if workflow not found, `400` if inactive or execution error.
