# Workflow Engine

A custom DAG-based workflow automation engine similar to n8n, built with TypeScript and Fastify.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Core Concepts](#core-concepts)
- [Built-in Nodes](#built-in-nodes)
- [AI Nodes (Planned)](#ai-nodes-planned)
- [How Tool Calling Works](#how-tool-calling-works)
- [API Reference](#api-reference)
- [Creating Custom Nodes](#creating-custom-nodes)

---

## Overview

This workflow engine provides:

- **DAG Execution**: Queue-based breadth-first workflow processing
- **Schema-Driven Nodes**: UI forms auto-generated from node schemas
- **Expression System**: `{{ $json.field }}` syntax for dynamic data binding
- **Multi-Input Handling**: Merge nodes wait for all inputs before executing
- **Sandboxed Code Execution**: Isolated V8 environment for custom JavaScript
- **tRPC API**: Type-safe API for frontend integration

### Tech Stack

| Component | Technology |
|-----------|------------|
| Server | Fastify |
| API | tRPC |
| Expressions | expr-eval |
| Code Sandbox | isolated-vm |
| Validation | Zod |

---

## Architecture

```
src/
├── engine/                    # Core workflow execution
│   ├── WorkflowRunner.ts      # Main execution engine
│   ├── NodeRegistry.ts        # Node type registry
│   ├── WorkflowValidator.ts   # Pre-execution validation
│   ├── ExpressionEngine.ts    # {{ expression }} resolver
│   ├── nodeSchema.ts          # Schema types for UI generation
│   └── types.ts               # Core execution types
│
├── nodes/                     # Built-in node implementations
│   ├── BaseNode.ts            # Abstract base class
│   ├── Start.ts               # Manual trigger
│   ├── Webhook.ts             # HTTP webhook trigger
│   ├── Cron.ts                # Scheduled trigger
│   ├── ErrorTrigger.ts        # Error handler trigger
│   ├── Set.ts                 # Data transformation
│   ├── HttpRequest.ts         # External API calls
│   ├── Code.ts                # Custom JavaScript
│   ├── If.ts                  # Binary branching
│   ├── Switch.ts              # Multi-branch routing
│   ├── Merge.ts               # Combine branches
│   ├── SplitInBatches.ts      # Batch processing
│   ├── Wait.ts                # Time delay
│   └── index.ts               # Exports
│
├── storage/                   # In-memory data stores (POC)
│   ├── WorkflowStore.ts       # Workflow persistence
│   └── ExecutionStore.ts      # Execution history
│
├── schemas/                   # Shared schema definitions
│   └── workflow.ts            # Re-exports from @cmdstd/schemas
│
├── trpc/                      # tRPC API
│   ├── router.ts              # Combined router
│   └── routers/
│       ├── workflows.ts       # Workflow CRUD + execute
│       ├── executions.ts      # Execution history
│       └── nodes.ts           # Node type info
│
├── routes/                    # REST endpoints
│   └── webhooks.ts            # Webhook receiver
│
└── index.ts                   # Fastify server setup
```

---

## Getting Started

### Installation

```bash
cd apps/workflow-engine
npm install
```

### Development

```bash
npm run dev    # Start with hot reload (tsx watch)
```

### Production

```bash
npm run build  # Compile TypeScript
npm start      # Run compiled code
```

### Environment Variables

```bash
# Server
PORT=3000

# AI Nodes (when implemented)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

---

## Core Concepts

### Workflow Structure

A workflow consists of **nodes** connected by **connections**:

```typescript
interface Workflow {
  id: string;
  name: string;
  nodes: NodeDefinition[];
  connections: Connection[];
  active: boolean;
}

interface NodeDefinition {
  name: string;           // Unique within workflow
  type: string;           // e.g., "HttpRequest", "Set"
  parameters: Record<string, unknown>;
}

interface Connection {
  sourceNode: string;
  targetNode: string;
  sourceOutput: string;   // e.g., "main", "true", "false"
}
```

### Execution Flow

```
1. Trigger node starts (Start, Webhook, Cron)
         │
         ▼
2. WorkflowRunner queues downstream nodes
         │
         ▼
3. For each job in queue:
   a. Resolve expressions in parameters
   b. Execute node
   c. Store output in nodeStates
   d. Queue connected nodes
         │
         ▼
4. Continue until queue is empty
         │
         ▼
5. Return execution result
```

### Expression System

Access data from previous nodes using expressions:

```
{{ $json.fieldName }}              # Current item's field
{{ $json.nested.field }}           # Nested access
{{ $node["NodeName"].json.field }} # Specific node's output
{{ $input[0].json.field }}         # First input item
{{ $env.API_KEY }}                 # Environment variable
{{ $execution.id }}                # Execution metadata
```

Built-in functions:
- `String()`, `Number()`, `JSON_parse()`
- `trim()`, `split()`, `join()`, `replace()`
- `includes()`, `substring()`, `length()`
- `first()`, `last()`, `at()`
- `now()`, `typeof()`, `isArray()`, `isEmpty()`

### Node Data Format

All nodes receive and return `NodeData[]`:

```typescript
interface NodeData {
  json: Record<string, unknown>;  // Main data payload
  binary?: Buffer;                 // Optional binary data
}
```

---

## Built-in Nodes

### Trigger Nodes

| Node | Description |
|------|-------------|
| **Start** | Manual workflow trigger, entry point for testing |
| **Webhook** | HTTP POST trigger, receives external requests |
| **Cron** | Scheduled trigger (interval or cron expression) |
| **ErrorTrigger** | Catches errors from other workflows |

### Transform Nodes

| Node | Description |
|------|-------------|
| **Set** | Create, update, delete, rename fields |
| **HttpRequest** | Make HTTP requests (GET, POST, PUT, DELETE) |
| **Code** | Execute custom JavaScript in V8 sandbox |

### Flow Control Nodes

| Node | Description | Outputs |
|------|-------------|---------|
| **If** | Binary branching based on condition | `true`, `false` |
| **Switch** | Multi-branch routing | Dynamic (per rule) |
| **Merge** | Combine multiple branches | `main` |
| **SplitInBatches** | Process arrays in chunks | `loop`, `done` |
| **Wait** | Pause execution for duration | `main` |

---

## AI Nodes (Planned)

Two AI-powered nodes are planned for implementation:

### 1. LLM Chat Node

Simple single-call LLM integration:

```
Input ──▶ LLM ──▶ Output
```

**Features:**
- Provider selection (Anthropic, OpenAI)
- Model selection (Claude, GPT-4, etc.)
- System prompt + user prompt
- Temperature, max tokens controls
- No tool calling

### 2. AI Agent Node

True agentic loop with autonomous tool use:

```
Input ──▶ LLM ──┬──▶ Tool Call? ──YES──▶ Execute Tool ──┐
               │                                        │
               │◀───────────────────────────────────────┘
               │
              NO
               │
               ▼
            Output
```

**Features:**
- ReAct pattern (Reason + Act)
- Tool calling with automatic execution
- Multi-iteration loops (configurable max)
- Memory/conversation history
- Built-in tools (HTTP, Code, etc.)
- Custom tool definitions

### API Keys Required

To use AI nodes, you'll need API keys:

#### Anthropic (Claude)

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Set `ANTHROPIC_API_KEY` environment variable

#### OpenAI

1. Go to https://platform.openai.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new secret key
5. Set `OPENAI_API_KEY` environment variable

---

## How Tool Calling Works

This section explains how LLM tool calling works for the AI Agent node.

### Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. YOU define tools         2. LLM "requests"        3. YOU execute     │
│     (schema only)               a tool call              the tool        │
│                                                                          │
│  ┌─────────────────┐        ┌─────────────────┐      ┌────────────────┐  │
│  │ {               │        │ "I need to call │      │ Your code      │  │
│  │   name: "search"│  ───▶  │  search with    │ ───▶ │ actually runs  │  │
│  │   description.. │        │  query='...' "  │      │ the search     │  │
│  │   parameters... │        │                 │      │                │  │
│  │ }               │        │ (tool_use block)│      │ return result  │  │
│  └─────────────────┘        └─────────────────┘      └───────┬────────┘  │
│                                                              │           │
│                                                              ▼           │
│                             ┌─────────────────┐      ┌────────────────┐  │
│                             │ LLM continues   │ ◀─── │ Feed result    │  │
│                             │ with result     │      │ back to LLM    │  │
│                             └─────────────────┘      └────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Key insight**: The LLM **never executes anything**. It outputs a structured request saying "I want to call X with these params". **Your code** does the actual execution.

### Step-by-Step Flow

#### Step 1: Define Tools (JSON Schema)

```typescript
const tools = [
  {
    name: 'get_weather',
    description: 'Get current weather for a city',
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name' },
        unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
      },
      required: ['city'],
    },
  },
  {
    name: 'search_database',
    description: 'Search the product database',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
];
```

#### Step 2: Send Request with Tools

```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  tools: tools,  // <-- Include tool definitions
  messages: [
    { role: 'user', content: 'What is the weather in Tokyo?' }
  ],
});
```

#### Step 3: LLM Responds with Tool Use

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "text",
      "text": "I'll check the weather in Tokyo for you."
    },
    {
      "type": "tool_use",
      "id": "toolu_01ABC123",
      "name": "get_weather",
      "input": { "city": "Tokyo" }
    }
  ]
}
```

#### Step 4: Execute Tool (Your Code)

```typescript
async function executeTool(name: string, input: Record<string, unknown>) {
  switch (name) {
    case 'get_weather':
      // Call real weather API
      const response = await fetch(`https://api.weather.com/...`);
      return response.json();
    case 'search_database':
      // Query real database
      return await db.products.search(input.query);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const result = await executeTool('get_weather', { city: 'Tokyo' });
```

#### Step 5: Feed Result Back to LLM

```typescript
messages.push({ role: 'assistant', content: response.content });
messages.push({
  role: 'user',
  content: [{
    type: 'tool_result',
    tool_use_id: 'toolu_01ABC123',
    content: JSON.stringify(result),
  }],
});

// Call LLM again with updated messages
const finalResponse = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  tools: tools,
  messages: messages,
});
```

#### Step 6: LLM Generates Final Response

```json
{
  "stop_reason": "end_turn",
  "content": [
    {
      "type": "text",
      "text": "The weather in Tokyo is currently 22°C and sunny."
    }
  ]
}
```

### The Agent Loop

For a true agentic node, this process loops until the LLM decides it's done:

```typescript
async function runAgent(userPrompt: string) {
  let messages = [{ role: 'user', content: userPrompt }];

  while (true) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      tools: tools,
      messages,
    });

    // Done?
    if (response.stop_reason === 'end_turn') {
      return response.content.find(c => c.type === 'text')?.text;
    }

    // Execute tool calls
    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      messages.push({ role: 'user', content: toolResults });
    }
  }
}
```

### Mapping to Workflow Nodes

The AI Agent node exposes existing workflow nodes as tools:

| Workflow Node | Agent Tool | Description |
|---------------|------------|-------------|
| HttpRequest | `http_request` | Make API calls |
| Code | `run_javascript` | Execute custom code |
| Set | `transform_data` | Transform data fields |

This allows the agent to autonomously use workflow capabilities during execution.

---

## API Reference

### tRPC Routes

#### Workflows

| Method | Description |
|--------|-------------|
| `workflows.list` | Get all workflows |
| `workflows.get(id)` | Get workflow by ID |
| `workflows.create(data)` | Create new workflow |
| `workflows.update(id, data)` | Update workflow |
| `workflows.delete(id)` | Delete workflow |
| `workflows.activate(id)` | Activate workflow |
| `workflows.deactivate(id)` | Deactivate workflow |
| `workflows.execute(id, data?)` | Execute workflow |

#### Executions

| Method | Description |
|--------|-------------|
| `executions.list(workflowId?)` | Get execution history |
| `executions.get(id)` | Get execution by ID |
| `executions.delete(id)` | Delete execution |

#### Nodes

| Method | Description |
|--------|-------------|
| `nodes.list` | Get all node types with schemas |
| `nodes.getInfo(type)` | Get specific node type info |

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook/:workflowId` | POST | Trigger webhook workflow |

---

## Creating Custom Nodes

### 1. Create Node Class

```typescript
// src/nodes/MyCustomNode.ts
import type { NodeDefinition } from '../schemas/workflow.js';
import type { ExecutionContext, NodeData, NodeExecutionResult } from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';

export class MyCustomNode extends BaseNode {
  readonly type = 'MyCustom';
  readonly description = 'Does something custom';

  static readonly nodeDescription: INodeTypeDescription = {
    name: 'MyCustom',
    displayName: 'My Custom Node',
    icon: 'fa:star',
    description: 'Does something custom',
    group: ['transform'],
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' }],
    outputs: [{ name: 'main', displayName: 'Output', type: 'main' }],

    properties: [
      {
        displayName: 'My Parameter',
        name: 'myParam',  // Must match getParameter() call
        type: 'string',
        default: '',
        required: true,
        description: 'Description for UI',
      },
    ],
  };

  async execute(
    context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    const myParam = this.getParameter<string>(nodeDefinition, 'myParam');

    const results: NodeData[] = inputData.map(item => ({
      json: {
        ...item.json,
        processed: true,
        myParam,
      },
    }));

    return this.output(results);
  }
}
```

### 2. Export from Index

```typescript
// src/nodes/index.ts
export { MyCustomNode } from './MyCustomNode.js';
```

### 3. Register in NodeRegistry

```typescript
// src/engine/NodeRegistry.ts
import { MyCustomNode } from '../nodes/index.js';

NodeRegistry.register(MyCustomNode);
```

### Property Types

| Type | UI Component | Example |
|------|--------------|---------|
| `string` | Text input | `{ type: 'string', default: '' }` |
| `number` | Number input | `{ type: 'number', default: 0 }` |
| `boolean` | Toggle | `{ type: 'boolean', default: false }` |
| `options` | Dropdown | `{ type: 'options', options: [...] }` |
| `json` | Code editor | `{ type: 'json', typeOptions: { language: 'json' } }` |
| `collection` | Repeatable fields | `{ type: 'collection', properties: [...] }` |

### Conditional Display

Show/hide fields based on other field values:

```typescript
{
  displayName: 'Body',
  name: 'body',
  type: 'json',
  displayOptions: {
    show: { method: ['POST', 'PUT', 'PATCH'] },
  },
}
```

---

## Roadmap

### Current Status (POC)

- [x] Core execution engine
- [x] Expression system
- [x] 12 built-in nodes
- [x] tRPC API
- [x] Webhook support
- [x] In-memory storage

### Planned

- [ ] **AI Nodes**: LLM Chat + AI Agent with tool calling
- [ ] **Persistent Storage**: Database-backed workflows/executions
- [ ] **Authentication**: API key / OAuth
- [ ] **Cron Scheduling**: Background job runner
- [ ] **More Nodes**: Database, email, file operations
- [ ] **Error Handling**: Better retry configuration
- [ ] **Streaming**: SSE for long-running operations

---

## License

MIT
