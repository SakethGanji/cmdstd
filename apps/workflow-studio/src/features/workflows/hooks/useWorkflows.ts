import { useQuery } from '@tanstack/react-query';
import { backends } from '@/shared/lib/config';

// Types matching our UI needs (camelCase)
interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDefinition {
  nodes: Array<{
    name: string;
    type: string;
    parameters: Record<string, unknown>;
    position?: { x: number; y: number };
  }>;
  connections: Array<{
    sourceNode: string;
    targetNode: string;
    sourceOutput: string;
    targetInput: string;
  }>;
}

export interface WorkflowWithDefinition extends WorkflowSummary {
  definition: WorkflowDefinition;
}

// API response types (snake_case from backend)
interface ApiWorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  node_count: number;
  created_at: string;
  updated_at: string;
}

interface ApiWorkflowDetail extends ApiWorkflowSummary {
  definition: {
    nodes: Array<{
      name: string;
      type: string;
      parameters: Record<string, unknown>;
      position?: { x: number; y: number };
    }>;
    connections: Array<{
      source_node: string;
      target_node: string;
      source_output: string;
      target_input: string;
    }>;
  };
}

// Transform API response to UI format
function transformWorkflow(api: ApiWorkflowDetail): WorkflowWithDefinition {
  return {
    id: api.id,
    name: api.name,
    active: api.active,
    nodeCount: api.node_count,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    definition: {
      nodes: api.definition.nodes,
      connections: api.definition.connections.map((conn) => ({
        sourceNode: conn.source_node,
        targetNode: conn.target_node,
        sourceOutput: conn.source_output,
        targetInput: conn.target_input,
      })),
    },
  };
}

async function fetchWorkflows(): Promise<WorkflowWithDefinition[]> {
  const baseUrl = `${backends.workflow}/api`;

  // Fetch workflow list
  const listRes = await fetch(`${baseUrl}/workflows`);
  if (!listRes.ok) throw new Error('Failed to fetch workflows');
  const summaries: ApiWorkflowSummary[] = await listRes.json();

  // Fetch definitions in parallel
  const details = await Promise.all(
    summaries.map(async (summary) => {
      const detailRes = await fetch(`${baseUrl}/workflows/${summary.id}`);
      if (!detailRes.ok) throw new Error(`Failed to fetch workflow ${summary.id}`);
      return detailRes.json() as Promise<ApiWorkflowDetail>;
    })
  );

  return details.map(transformWorkflow);
}

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: fetchWorkflows,
    staleTime: 1000 * 60 * 5,
  });
}
