# Workflow Engine API Guide

Base URL: `http://localhost:3001/api`

## Workflows

### List All Workflows (My Workflows Page)

```
GET /api/workflows
```

**Response:**
```json
[
  {
    "id": "wf_1765415267029_c2fd0104",
    "name": "Fetch Random User",
    "active": false,
    "webhook_url": "/webhook/wf_1765415267029_c2fd0104",
    "node_count": 3,
    "created_at": "2025-12-10T19:07:47.029000",
    "updated_at": "2025-12-10T19:07:47.029000"
  }
]
```

**UI Usage:**
```typescript
const response = await fetch('/api/workflows');
const workflows = await response.json();

// Display in a list/table
workflows.map(wf => ({
  id: wf.id,
  name: wf.name,
  nodeCount: wf.node_count,
  isActive: wf.active,
  createdAt: new Date(wf.created_at)
}));
```

---

### Get Workflow Details

```
GET /api/workflows/{workflow_id}
```

**Response:**
```json
{
  "id": "wf_1765415267029_c2fd0104",
  "name": "Fetch Random User",
  "active": false,
  "webhook_url": "/webhook/wf_1765415267029_c2fd0104",
  "definition": {
    "nodes": [
      {
        "name": "Start",
        "type": "Start",
        "parameters": {},
        "position": { "x": 100, "y": 200 }
      },
      {
        "name": "Fetch User",
        "type": "HttpRequest",
        "parameters": {
          "url": "https://randomuser.me/api/",
          "method": "GET"
        },
        "position": { "x": 350, "y": 200 }
      }
    ],
    "connections": [
      {
        "source_node": "Start",
        "target_node": "Fetch User",
        "source_output": "main",
        "target_input": "main"
      }
    ],
    "settings": {}
  },
  "created_at": "2025-12-10T19:07:47.029000",
  "updated_at": "2025-12-10T19:07:47.029000"
}
```

**UI Usage:**
```typescript
const response = await fetch(`/api/workflows/${workflowId}`);
const workflow = await response.json();

// Use for canvas editor
const nodes = workflow.definition.nodes;
const connections = workflow.definition.connections;
```

---

### Run a Workflow

```
POST /api/workflows/{workflow_id}/run
```

**Response (Success):**
```json
{
  "status": "success",
  "execution_id": "exec_1765415024556_b9620d2",
  "data": {
    "Start": [{ "json": { "triggeredAt": "2025-12-10T19:03:44", "mode": "manual" } }],
    "Fetch User": [{ "json": { "statusCode": 200, "body": {...} } }],
    "Extract Data": [{ "json": { "name": "John Doe", "email": "john@example.com" } }]
  },
  "errors": []
}
```

**Response (Failed):**
```json
{
  "status": "failed",
  "execution_id": "exec_1765414824738_e9f0bdf",
  "data": {
    "Start": [{ "json": {...} }]
  },
  "errors": [
    {
      "node_name": "Fetch User",
      "error": "Connection timeout",
      "timestamp": "2025-12-10T19:00:24.769958"
    }
  ]
}
```

**UI Usage:**
```typescript
const runWorkflow = async (workflowId: string) => {
  const response = await fetch(`/api/workflows/${workflowId}/run`, {
    method: 'POST'
  });
  const result = await response.json();

  if (result.status === 'success') {
    // Show success, display final node output
    const nodeNames = Object.keys(result.data);
    const lastNode = nodeNames[nodeNames.length - 1];
    const output = result.data[lastNode];
    console.log('Output:', output);
  } else {
    // Show errors
    result.errors.forEach(err => {
      console.error(`Error in ${err.node_name}: ${err.error}`);
    });
  }
};
```

---

### Create a Workflow

```
POST /api/workflows
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "My New Workflow",
  "description": "Optional description",
  "nodes": [
    {
      "name": "Start",
      "type": "Start",
      "parameters": {},
      "position": { "x": 100, "y": 200 }
    },
    {
      "name": "Set Data",
      "type": "Set",
      "parameters": {
        "mode": "json",
        "jsonData": "{\"message\": \"Hello World\"}",
        "keepOnlySet": true
      },
      "position": { "x": 350, "y": 200 }
    }
  ],
  "connections": [
    {
      "source_node": "Start",
      "target_node": "Set Data"
    }
  ],
  "settings": {}
}
```

**Response:**
```json
{
  "id": "wf_1765415267029_newid",
  "name": "My New Workflow",
  "active": false,
  "webhook_url": "/webhook/wf_1765415267029_newid",
  "created_at": "2025-12-10T19:07:47.029000"
}
```

---

### Update a Workflow

```
PUT /api/workflows/{workflow_id}
Content-Type: application/json
```

**Request Body:** (same structure as create, all fields optional)
```json
{
  "name": "Updated Name",
  "nodes": [...],
  "connections": [...]
}
```

---

### Delete a Workflow

```
DELETE /api/workflows/{workflow_id}
```

**Response:**
```json
{
  "success": true,
  "message": "Workflow deleted"
}
```

---

### Toggle Workflow Active State

```
PATCH /api/workflows/{workflow_id}/active
Content-Type: application/json
```

**Request Body:**
```json
{
  "active": true
}
```

**Response:**
```json
{
  "id": "wf_1765415267029_c2fd0104",
  "active": true
}
```

---

## Nodes

### List Available Node Types

```
GET /api/nodes
```

**Response:**
```json
[
  {
    "name": "Start",
    "display_name": "Start",
    "description": "Workflow entry point for manual execution",
    "icon": "fa:play",
    "group": ["triggers"]
  },
  {
    "name": "HttpRequest",
    "display_name": "HTTP Request",
    "description": "Makes HTTP requests to external APIs",
    "icon": "fa:globe",
    "group": ["transform"]
  },
  {
    "name": "Code",
    "display_name": "Code",
    "description": "Execute custom Python code",
    "icon": "fa:code",
    "group": ["transform"]
  }
]
```

**UI Usage:**
```typescript
// For node palette/toolbox
const response = await fetch('/api/nodes');
const nodeTypes = await response.json();

// Group by category
const grouped = nodeTypes.reduce((acc, node) => {
  const group = node.group[0] || 'other';
  acc[group] = acc[group] || [];
  acc[group].push(node);
  return acc;
}, {});
```

---

### Get Node Schema (for property panel)

```
GET /api/nodes/{node_type}
```

**Example:** `GET /api/nodes/HttpRequest`

**Response:**
```json
{
  "name": "HttpRequest",
  "display_name": "HTTP Request",
  "description": "Makes HTTP requests to external APIs",
  "icon": "fa:globe",
  "group": ["transform"],
  "inputs": [
    { "name": "main", "display_name": "Input" }
  ],
  "outputs": [
    { "name": "main", "display_name": "Response" }
  ],
  "properties": [
    {
      "name": "method",
      "display_name": "Method",
      "type": "options",
      "default": "GET",
      "required": true,
      "options": [
        { "name": "GET", "value": "GET" },
        { "name": "POST", "value": "POST" }
      ]
    },
    {
      "name": "url",
      "display_name": "URL",
      "type": "string",
      "default": "",
      "required": true,
      "placeholder": "https://api.example.com/endpoint"
    }
  ]
}
```

**UI Usage:**
```typescript
// When user selects a node, fetch its schema for the property panel
const response = await fetch(`/api/nodes/${selectedNode.type}`);
const schema = await response.json();

// Render form based on properties
schema.properties.forEach(prop => {
  if (prop.type === 'options') {
    // Render dropdown
  } else if (prop.type === 'string') {
    // Render text input
  } else if (prop.type === 'boolean') {
    // Render checkbox
  }
});
```

---

## Executions

### List Execution History

```
GET /api/executions
GET /api/executions?workflow_id={workflow_id}
```

**Response:**
```json
[
  {
    "id": "exec_1765415024556_b9620d2",
    "workflow_id": "wf_1765415267029_c2fd0104",
    "workflow_name": "Fetch Random User",
    "status": "success",
    "mode": "manual",
    "start_time": "2025-12-10T19:03:44.556406",
    "end_time": "2025-12-10T19:03:45.123456"
  }
]
```

---

### Get Execution Details

```
GET /api/executions/{execution_id}
```

**Response:**
```json
{
  "id": "exec_1765415024556_b9620d2",
  "workflow_id": "wf_1765415267029_c2fd0104",
  "workflow_name": "Fetch Random User",
  "status": "success",
  "mode": "manual",
  "node_data": {
    "Start": [{ "json": {...} }],
    "Fetch User": [{ "json": {...} }],
    "Extract Data": [{ "json": {...} }]
  },
  "errors": [],
  "start_time": "2025-12-10T19:03:44.556406",
  "end_time": "2025-12-10T19:03:45.123456"
}
```

---

## Real-time Execution (SSE)

For real-time updates during workflow execution, use Server-Sent Events:

```
GET /api/stream/executions/{execution_id}
```

**UI Usage:**
```typescript
const streamExecution = (executionId: string) => {
  const eventSource = new EventSource(`/api/stream/executions/${executionId}`);

  eventSource.addEventListener('node:start', (e) => {
    const data = JSON.parse(e.data);
    console.log(`Node started: ${data.node_name}`);
    // Highlight node in canvas
  });

  eventSource.addEventListener('node:complete', (e) => {
    const data = JSON.parse(e.data);
    console.log(`Node complete: ${data.node_name}`, data.data);
    // Update node status, show output
  });

  eventSource.addEventListener('node:error', (e) => {
    const data = JSON.parse(e.data);
    console.error(`Node error: ${data.node_name}`, data.error);
    // Show error state on node
  });

  eventSource.addEventListener('execution:complete', (e) => {
    const data = JSON.parse(e.data);
    console.log('Execution complete', data);
    eventSource.close();
  });
};
```

---

## Quick Reference

| Action | Method | Endpoint |
|--------|--------|----------|
| List workflows | GET | `/api/workflows` |
| Get workflow | GET | `/api/workflows/{id}` |
| Create workflow | POST | `/api/workflows` |
| Update workflow | PUT | `/api/workflows/{id}` |
| Delete workflow | DELETE | `/api/workflows/{id}` |
| Run workflow | POST | `/api/workflows/{id}/run` |
| Toggle active | PATCH | `/api/workflows/{id}/active` |
| List node types | GET | `/api/nodes` |
| Get node schema | GET | `/api/nodes/{type}` |
| List executions | GET | `/api/executions` |
| Get execution | GET | `/api/executions/{id}` |
| Stream execution | GET | `/api/stream/executions/{id}` |
