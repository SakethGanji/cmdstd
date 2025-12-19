/**
 * REST API Client
 *
 * Fetch-based API client to communicate with the workflow-engine backend.
 * Replaces tRPC with standard REST calls.
 */

// ============================================================================
// Types (internal - used by API functions)
// ============================================================================

// Backend workflow format (simplified for API layer)
interface BackendNodeDefinition {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  position?: { x: number; y: number };
  continueOnFail?: boolean;
  retryOnFail?: number;
  retryDelay?: number;
  pinnedData?: { json: Record<string, unknown> }[];
}

interface BackendConnection {
  source_node: string;
  source_output: string;
  target_node: string;
  target_input: string;
  connection_type?: 'normal' | 'subnode';
  slot_name?: string;
}

interface BackendWorkflow {
  id?: string;
  name: string;
  nodes: BackendNodeDefinition[];
  connections: BackendConnection[];
}

interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  webhookUrl: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowDetail {
  id: string;
  name: string;
  active: boolean;
  webhookUrl: string;
  definition: BackendWorkflow;
  createdAt: string;
  updatedAt: string;
}

interface CreateWorkflowResponse {
  id: string;
  name: string;
  active: boolean;
  webhookUrl: string;
  createdAt: string;
}

interface UpdateWorkflowResponse {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string;
}

interface SetActiveResponse {
  id: string;
  active: boolean;
}

interface ExecutionResult {
  status: 'success' | 'failed';
  executionId: string;
  data: Record<string, unknown>;
  errors: { nodeName: string; error: string }[];
}

interface NodeTypeInfo {
  type: string;
  displayName: string;
  description: string;
  icon: string;
  group: string[];
  inputCount: number;
  outputCount: number;
  properties: {
    name: string;
    displayName: string;
    type: string;
    default?: unknown;
    required?: boolean;
    description?: string;
    options?: { name: string; value: unknown }[];
    displayOptions?: {
      show?: Record<string, unknown[]>;
      hide?: Record<string, unknown[]>;
    };
  }[];
  inputs: { name: string; displayName: string; type: string; required?: boolean }[];
  outputs: { name: string; displayName: string; type: string; schema?: unknown }[];
}

// ============================================================================
// API Client
// ============================================================================

import { backends } from './config';

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${backends.workflow}/api${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Workflows API
// ============================================================================

export const workflowsApi = {
  list: (): Promise<WorkflowSummary[]> => {
    return apiFetch('/workflows');
  },

  get: (id: string): Promise<WorkflowDetail> => {
    return apiFetch(`/workflows/${id}`);
  },

  create: (workflow: BackendWorkflow): Promise<CreateWorkflowResponse> => {
    return apiFetch('/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  },

  update: (id: string, workflow: BackendWorkflow): Promise<UpdateWorkflowResponse> => {
    return apiFetch(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workflow),
    });
  },

  delete: (id: string): Promise<{ success: boolean }> => {
    return apiFetch(`/workflows/${id}`, {
      method: 'DELETE',
    });
  },

  setActive: (id: string, active: boolean): Promise<SetActiveResponse> => {
    return apiFetch(`/workflows/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
  },

  run: (id: string): Promise<ExecutionResult> => {
    return apiFetch(`/workflows/${id}/run`, {
      method: 'POST',
    });
  },

  runAdhoc: (workflow: BackendWorkflow): Promise<ExecutionResult> => {
    return apiFetch('/workflows/run-adhoc', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  },
};

// ============================================================================
// Nodes API
// ============================================================================

export const nodesApi = {
  list: (): Promise<NodeTypeInfo[]> => {
    return apiFetch('/nodes');
  },

  get: (type: string): Promise<NodeTypeInfo> => {
    return apiFetch(`/nodes/${type}`);
  },
};
