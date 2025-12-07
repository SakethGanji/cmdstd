# Workflow Studio

A visual workflow editor built with React, ReactFlow, and Zustand. This is the frontend for the workflow automation system, inspired by n8n's workflow automation UI.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Backend Integration Guide](#backend-integration-guide)
- [Data Format Differences](#data-format-differences)
- [Saving a Workflow](#saving-a-workflow)
- [Loading a Workflow](#loading-a-workflow)
- [Running a Workflow](#running-a-workflow)
- [UI State Management](#ui-state-management)
- [Validation](#validation)
- [Execution Data Display](#execution-data-display)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Multi-Output Nodes](#multi-output-nodes)
- [API Endpoints Reference](#api-endpoints-reference)
- [Integration Checklist](#integration-checklist)

---

## Architecture Overview

```
src/
├── components/
│   ├── canvas/           # ReactFlow canvas components
│   │   ├── nodes/        # Custom node types (WorkflowNode, StickyNote, AddNodesButton)
│   │   └── edges/        # Custom edge types (WorkflowEdge)
│   ├── ndv/              # Node Details View (configuration modal)
│   ├── node-creator/     # Node selection panel
│   ├── workflow-navbar/  # Top navigation bar
│   └── ui/               # shadcn/ui components
├── stores/               # Zustand state management
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and transformations
├── types/                # TypeScript type definitions
└── routes/               # TanStack Router pages
```

---

## Backend Integration Guide

### Key Transformation File

**`src/lib/workflowTransform.ts`** - Contains all utilities for converting between UI and backend formats.

```typescript
import {
  toBackendWorkflow,    // ReactFlow → Backend
  fromBackendWorkflow,  // Backend → ReactFlow
  toBackendNodeType,    // 'httpRequest' → 'HttpRequest'
  toUINodeType,         // 'HttpRequest' → 'httpRequest'
  generateNodeName,     // Generate unique names
  getExistingNodeNames, // Get all node names
  hasTriggerNode,       // Validation helper
  validateUniqueNames,  // Validation helper
} from './lib/workflowTransform';
```

---

## Data Format Differences

| Concept | UI (ReactFlow) | Backend (API) |
|---------|----------------|---------------|
| Node identifier | `node.id` (e.g., `node-1234567890`) | `node.name` (e.g., `HttpRequest`, `HttpRequest1`) |
| Node type | camelCase (e.g., `httpRequest`) | PascalCase (e.g., `HttpRequest`) |
| Edge source | `edge.source` (node id) | `connection.sourceNode` (node name) |
| Edge target | `edge.target` (node id) | `connection.targetNode` (node name) |
| Handle | `sourceHandle` / `targetHandle` | `sourceOutput` / `targetInput` (default: `'main'`) |
| Pinned data | `{ json: {...} }[]` | `{ json: {...} }[]` (same format) |

### Node Type Mapping

```typescript
// UI Type → Backend Type
const mapping = {
  'manualTrigger': 'Start',
  'scheduleTrigger': 'Cron',
  'webhook': 'Webhook',
  'errorTrigger': 'ErrorTrigger',
  'set': 'Set',
  'code': 'Code',
  'if': 'If',
  'switch': 'Switch',
  'merge': 'Merge',
  'splitInBatches': 'SplitInBatches',
  'httpRequest': 'HttpRequest',
  'wait': 'Wait',
};
```

---

## Saving a Workflow

```typescript
import { toBackendWorkflow } from './lib/workflowTransform';
import { useWorkflowStore } from './stores/workflowStore';

// Get current state
const { nodes, edges, workflowName, workflowId } = useWorkflowStore.getState();

// Transform to backend format
const backendWorkflow = toBackendWorkflow(nodes, edges, workflowName, workflowId);

// API call
const response = await trpc.workflows.create.mutate(backendWorkflow);
// or for updates:
const response = await trpc.workflows.update.mutate({ id: workflowId, ...backendWorkflow });

// Store the returned ID
useWorkflowStore.getState().setWorkflowId(response.id);
```

### Backend Workflow Schema (Expected Format)

```typescript
interface BackendWorkflow {
  id?: string;                    // Optional for create, required for update
  name: string;                   // Workflow display name
  nodes: BackendNodeDefinition[];
  connections: BackendConnection[];
}

interface BackendNodeDefinition {
  name: string;                   // Unique identifier (e.g., 'HttpRequest', 'HttpRequest1')
  type: string;                   // Node type in PascalCase (e.g., 'HttpRequest')
  parameters: Record<string, unknown>;
  position?: { x: number; y: number };
  continueOnFail?: boolean;       // Continue workflow on error (default: false)
  retryOnFail?: number;           // Retry count 0-10 (default: 0)
  retryDelay?: number;            // Delay between retries in ms (default: 1000)
  pinnedData?: { json: Record<string, unknown> }[];
}

interface BackendConnection {
  sourceNode: string;             // Source node name
  sourceOutput: string;           // Output port (default: 'main')
  targetNode: string;             // Target node name
  targetInput: string;            // Input port (default: 'main')
}
```

---

## Loading a Workflow

```typescript
import { fromBackendWorkflow } from './lib/workflowTransform';
import { useWorkflowStore } from './stores/workflowStore';

// Fetch from API
const backendWorkflow = await trpc.workflows.get.query({ id: 'wf_123' });

// Transform to ReactFlow format
const { nodes, edges } = fromBackendWorkflow(backendWorkflow);

// Update store
const store = useWorkflowStore.getState();
store.setNodes(nodes);
store.setEdges(edges);
store.setWorkflowName(backendWorkflow.name);
store.setWorkflowId(backendWorkflow.id);
```

---

## Running a Workflow

```typescript
// Run saved workflow
const execution = await trpc.workflows.run.mutate({ id: workflowId });

// Or run ad-hoc (without saving)
const backendWorkflow = toBackendWorkflow(nodes, edges, workflowName);
const execution = await trpc.workflows.runAdhoc.mutate(backendWorkflow);

// Poll for execution status
const result = await trpc.executions.get.query({ id: execution.id });
```

---

## UI State Management

### Stores

| Store | Purpose | Key State |
|-------|---------|-----------|
| `workflowStore` | Main workflow state | `nodes`, `edges`, `workflowName`, `workflowId`, `executionData`, `pinnedData` |
| `nodeCreatorStore` | Node picker panel | `isOpen`, `view`, `search`, `sourceNodeId` |
| `ndvStore` | Node details modal | `isOpen`, `activeNodeId`, `displayMode` |

### WorkflowNodeData Interface

```typescript
interface WorkflowNodeData {
  // Backend-compatible fields
  name: string;           // Unique identifier for connections
  type: string;           // UI node type (camelCase)
  parameters?: Record<string, unknown>;
  continueOnFail?: boolean;
  retryOnFail?: number;
  retryDelay?: number;
  pinnedData?: { json: Record<string, unknown> }[];
  disabled?: boolean;

  // UI-only fields
  label: string;          // Display name
  icon?: string;
  description?: string;

  // Sticky note fields (when node.type is 'stickyNote')
  content?: string;
  color?: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
}
```

---

## Validation

```typescript
import {
  hasTriggerNode,
  validateUniqueNames,
} from './lib/workflowTransform';

// Before saving, validate:

// 1. Check for at least one trigger
if (!hasTriggerNode(nodes)) {
  throw new Error('Workflow must have at least one trigger node');
}

// 2. Check for unique names
if (!validateUniqueNames(nodes)) {
  throw new Error('All nodes must have unique names');
}

// 3. Check for at least one node
const workflowNodes = nodes.filter(n => n.type === 'workflowNode');
if (workflowNodes.length === 0) {
  throw new Error('Workflow must have at least one node');
}
```

---

## Execution Data Display

When displaying execution results in the NDV:

```typescript
// Execution data from backend
interface ExecutionRecord {
  id: string;
  workflowId: string;
  status: 'running' | 'success' | 'failed';
  nodeData: Record<string, { json: Record<string, unknown> }[]>;
  errors: Array<{ nodeName: string; error: string; timestamp: Date }>;
}

// Map backend node names to UI node IDs for display
function mapExecutionDataToUI(
  executionRecord: ExecutionRecord,
  nodes: Node[]
) {
  const store = useWorkflowStore.getState();

  // Create mapping from node name to node id
  const nameToId = new Map<string, string>();
  nodes.forEach(node => {
    if (node.type === 'workflowNode') {
      nameToId.set(node.data.name, node.id);
    }
  });

  // Update execution data for each node
  Object.entries(executionRecord.nodeData).forEach(([nodeName, data]) => {
    const nodeId = nameToId.get(nodeName);
    if (nodeId) {
      store.setNodeExecutionData(nodeId, {
        input: null,
        output: { items: data.map(d => d.json) },
        status: 'success',
        startTime: Date.now(),
        endTime: Date.now(),
      });
    }
  });

  // Handle errors
  executionRecord.errors.forEach(({ nodeName, error }) => {
    const nodeId = nameToId.get(nodeName);
    if (nodeId) {
      store.setNodeExecutionData(nodeId, {
        input: null,
        output: { items: [], error },
        status: 'error',
      });
    }
  });
}
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save workflow |
| `Ctrl/Cmd + 0` | Fit to view |
| `Ctrl/Cmd + +/-` | Zoom in/out |
| `N` | Add new node |
| `T` | Add trigger node |
| `S` | Add sticky note |
| `F` | Fit to view |
| `Delete/Backspace` | Delete selected |
| `Escape` | Close panel/modal |

---

## Multi-Output Nodes

Some nodes have multiple outputs that need special handling:

| Node | Outputs | Handle IDs |
|------|---------|------------|
| If | true, false | `'true'`, `'false'` |
| Switch | dynamic + fallback | `'output0'`, `'output1'`, ..., `'fallback'` |
| SplitInBatches | loop, done | `'loop'`, `'done'` |

When creating connections from these nodes, the `sourceHandle` will contain the output name.

**Note:** Currently the UI only renders a single output handle. To fully support multi-output nodes, you'll need to:

1. Add multiple output handles to the WorkflowNode component based on node type
2. Map the handle IDs to the correct `sourceOutput` values

---

## API Endpoints Reference

### tRPC Routes (from backend at `apps/workflow-engine`)

```typescript
// Workflows
trpc.workflows.list.query()                    // Get all workflows
trpc.workflows.get.query({ id })               // Get workflow by ID
trpc.workflows.create.mutate(workflow)         // Create workflow
trpc.workflows.update.mutate({ id, ...workflow }) // Update workflow
trpc.workflows.delete.mutate({ id })           // Delete workflow
trpc.workflows.setActive.mutate({ id, active }) // Toggle active state
trpc.workflows.run.mutate({ id })              // Execute saved workflow
trpc.workflows.runAdhoc.mutate(workflow)       // Execute without saving

// Executions
trpc.executions.list.query({ workflowId? })    // List executions
trpc.executions.get.query({ id })              // Get execution details
trpc.executions.delete.mutate({ id })          // Delete execution

// Nodes (for dynamic form generation - future)
trpc.nodes.list.query()                        // Get all node type schemas
trpc.nodes.get.query({ type })                 // Get specific node schema
```

### REST Endpoints (Webhooks)

```
GET/POST/PUT/DELETE /webhook/:workflowId       # Webhook trigger endpoint
GET /health                                     # Health check
```

---

## Integration Checklist

### Setup

- [ ] Set up tRPC client in `src/lib/trpc.ts`
- [ ] Configure API base URL for backend connection
- [ ] Add error handling utilities

### Save/Load

- [ ] Add save handler to WorkflowNavbar (Ctrl+S)
- [ ] Implement "Save" button click handler
- [ ] Implement "Save As" / duplicate functionality
- [ ] Add workflow loading on page mount (if editing existing)
- [ ] Handle unsaved changes warning

### Execution

- [ ] Implement "Test workflow" / run button
- [ ] Add execution polling and status updates
- [ ] Map execution results to node execution data
- [ ] Display errors on failed nodes
- [ ] Add execution history sidebar/page

### UI Improvements

- [ ] Add toast notifications for save/error states
- [ ] Show loading states during API calls
- [ ] Display webhook URLs for Webhook trigger nodes
- [ ] Add workflow active/inactive toggle with API
- [ ] Implement workflow list/management page

### Advanced Features

- [ ] Fetch node schemas from backend for dynamic forms
- [ ] Add credential management UI
- [ ] Implement import/export workflows as JSON
- [ ] Add workflow versioning/history

---

## Important Notes

1. **Node Names**: The `name` field is critical - it's used in connections and must be unique within a workflow. The UI auto-generates unique names like `HttpRequest`, `HttpRequest1`, etc.

2. **Sticky Notes**: These are UI-only and are filtered out during `toBackendWorkflow()`. They won't be saved to the backend.

3. **Pinned Data**: Both UI and backend use the same format: `{ json: {...} }[]`. This allows testing nodes with fixed input data.

4. **Expression Syntax**: Both use `{{ expression }}` syntax. Supported variables:
   - `$json` - Current item's JSON data
   - `$input` - Input data from previous node
   - `$node["NodeName"]` - Access data from specific node
   - `$env.VARIABLE` - Environment variables
   - `$execution` - Execution context
   - `$itemIndex` - Current item index

5. **Filter Node**: The UI previously had a "Filter" node that doesn't exist in the backend. It has been removed from the node creator.

6. **Pre-existing TypeScript Errors**: There are React 19 / Radix UI compatibility errors in `src/components/ui/`. These are in shadcn components and don't affect runtime behavior.

---

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build
pnpm build

# Type check
pnpm typecheck
```

---

## Related Packages

- **`apps/workflow-engine`** - Backend API and execution engine
- **`packages/schemas`** - Shared Zod schemas for workflow definitions
