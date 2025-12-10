/**
 * REST API Client
 *
 * Fetch-based API client to communicate with the workflow-engine backend.
 * Replaces tRPC with standard REST calls.
 */

import type { BackendWorkflow } from './workflowTransform';

// ============================================================================
// Types (matching backend responses)
// ============================================================================

export interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  webhookUrl: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDetail {
  id: string;
  name: string;
  active: boolean;
  webhookUrl: string;
  definition: BackendWorkflow;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowResponse {
  id: string;
  name: string;
  active: boolean;
  webhookUrl: string;
  createdAt: string;
}

export interface UpdateWorkflowResponse {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string;
}

export interface SetActiveResponse {
  id: string;
  active: boolean;
}

export interface ExecutionResult {
  status: 'success' | 'failed';
  executionId: string;
  data: Record<string, unknown>;
  errors: ExecutionError[];
}

export interface ExecutionError {
  nodeName: string;
  error: string;
  timestamp?: string;
}

export interface ExecutionSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'success' | 'failed';
  mode: 'manual' | 'webhook' | 'cron';
  startTime: string;
  endTime?: string;
  errorCount: number;
}

export interface ExecutionDetail {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'success' | 'failed';
  mode: 'manual' | 'webhook' | 'cron';
  startTime: string;
  endTime?: string;
  errors: ExecutionError[];
  nodeData: Record<string, unknown>;
}

export interface NodeTypeInfo {
  type: string;
  displayName: string;
  description: string;
  icon: string;
  group: string[];
  inputCount: number;
  outputCount: number;
  properties: NodeProperty[];
  inputs: NodeInput[];
  outputs: NodeOutput[];
}

export interface NodeProperty {
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
}

export interface NodeInput {
  name: string;
  displayName: string;
  type: string;
  required?: boolean;
}

export interface NodeOutput {
  name: string;
  displayName: string;
  type: string;
  schema?: unknown;
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Get the API base URL
 */
function getBaseUrl(): string {
  if (import.meta.env.DEV) {
    return '/api';
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
}

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${getBaseUrl()}${endpoint}`;

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
// Executions API
// ============================================================================

export const executionsApi = {
  list: (workflowId?: string): Promise<ExecutionSummary[]> => {
    const query = workflowId ? `?workflowId=${workflowId}` : '';
    return apiFetch(`/executions${query}`);
  },

  get: (id: string): Promise<ExecutionDetail> => {
    return apiFetch(`/executions/${id}`);
  },

  delete: (id: string): Promise<{ success: boolean }> => {
    return apiFetch(`/executions/${id}`, {
      method: 'DELETE',
    });
  },

  clear: (): Promise<{ success: boolean }> => {
    return apiFetch('/executions', {
      method: 'DELETE',
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
