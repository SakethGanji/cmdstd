/**
 * Workflow API Hooks
 *
 * Custom hooks for workflow CRUD and execution operations.
 * Uses tRPC for type-safe API calls.
 */

import { trpc } from '@/lib/trpc';
import { useWorkflowStore } from '@/stores/workflowStore';
import {
  toBackendWorkflow,
  fromBackendWorkflow,
} from '@/lib/workflowTransform';
import { toast } from 'sonner';
import type { WorkflowNodeData } from '@/types/workflow';
import type { Node } from 'reactflow';

/**
 * Hook for saving workflows
 */
export function useSaveWorkflow() {
  const {
    nodes,
    edges,
    workflowName,
    workflowId,
    setWorkflowId,
  } = useWorkflowStore();

  const createMutation = trpc.workflows.create.useMutation();
  const updateMutation = trpc.workflows.update.useMutation();

  const saveWorkflow = async () => {
    const backendWorkflow = toBackendWorkflow(
      nodes as Node<WorkflowNodeData>[],
      edges,
      workflowName,
      workflowId
    );

    try {
      if (workflowId) {
        // Update existing workflow
        const result = await updateMutation.mutateAsync({
          id: workflowId,
          workflow: backendWorkflow,
        });
        toast.success('Workflow saved', {
          description: `"${result.name}" has been updated.`,
        });
        return result;
      } else {
        // Create new workflow
        const result = await createMutation.mutateAsync(backendWorkflow);
        setWorkflowId(result.id);
        toast.success('Workflow created', {
          description: `"${result.name}" has been saved.`,
        });
        return result;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to save workflow', {
        description: message,
      });
      throw error;
    }
  };

  return {
    saveWorkflow,
    isSaving: createMutation.isPending || updateMutation.isPending,
  };
}

/**
 * Hook for loading a workflow by ID
 */
export function useLoadWorkflow() {
  const {
    setNodes,
    setEdges,
    setWorkflowName,
    setWorkflowId,
    setIsActive,
  } = useWorkflowStore();

  const loadWorkflow = async (id: string, queryClient: ReturnType<typeof trpc.useUtils>) => {
    try {
      const result = await queryClient.workflows.get.fetch({ id });

      if (result) {
        const { nodes, edges } = fromBackendWorkflow(result.definition);
        setNodes(nodes);
        setEdges(edges);
        setWorkflowName(result.name);
        setWorkflowId(result.id);
        setIsActive(result.active);

        toast.success('Workflow loaded', {
          description: `"${result.name}" is ready to edit.`,
        });
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to load workflow', {
        description: message,
      });
      throw error;
    }
  };

  return { loadWorkflow };
}

/**
 * Hook for executing a workflow
 */
export function useExecuteWorkflow() {
  const {
    nodes,
    edges,
    workflowName,
    workflowId,
    setNodeExecutionData,
    clearExecutionData,
  } = useWorkflowStore();

  const runMutation = trpc.workflows.run.useMutation();
  const runAdhocMutation = trpc.workflows.runAdhoc.useMutation();

  const executeWorkflow = async () => {
    // Clear previous execution data
    clearExecutionData();

    // Mark all workflow nodes as running
    const workflowNodes = nodes.filter((n) => n.type === 'workflowNode');
    workflowNodes.forEach((node) => {
      setNodeExecutionData(node.id, {
        input: null,
        output: null,
        status: 'running',
        startTime: Date.now(),
      });
    });

    try {
      let result;

      if (workflowId) {
        // Run saved workflow
        result = await runMutation.mutateAsync({ id: workflowId });
      } else {
        // Run ad-hoc (unsaved) workflow
        const backendWorkflow = toBackendWorkflow(
          nodes as Node<WorkflowNodeData>[],
          edges,
          workflowName
        );
        result = await runAdhocMutation.mutateAsync(backendWorkflow);
      }

      // Map backend node names to UI node IDs and update execution data
      const nameToId = new Map<string, string>();
      workflowNodes.forEach((node) => {
        const data = node.data as WorkflowNodeData;
        nameToId.set(data.name, node.id);
      });

      // Update each node's execution data
      if (result.data) {
        Object.entries(result.data).forEach(([nodeName, outputData]) => {
          const nodeId = nameToId.get(nodeName);
          if (nodeId) {
            // Find input data (from previous node)
            const inputNodeName = findInputNode(nodeName, edges, workflowNodes);
            const inputData = inputNodeName ? result.data[inputNodeName] : null;

            const normalizedOutput = normalizeOutputData(outputData);

            setNodeExecutionData(nodeId, {
              input: inputData ? { items: normalizeOutputData(inputData) } : null,
              output: { items: normalizedOutput },
              status: 'success',
              startTime: Date.now(),
              endTime: Date.now(),
            });
          }
        });
      }

      // Handle errors
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((err: { nodeName: string; error: string }) => {
          const nodeId = nameToId.get(err.nodeName);
          if (nodeId) {
            setNodeExecutionData(nodeId, {
              input: null,
              output: { items: [], error: err.error },
              status: 'error',
              endTime: Date.now(),
            });
          }
        });

        toast.error('Workflow execution failed', {
          description: result.errors[0]?.error || 'Unknown error',
        });
      } else {
        toast.success('Workflow executed successfully', {
          description: `Execution ID: ${result.executionId}`,
        });
      }

      return result;
    } catch (error) {
      // Mark all nodes as error
      workflowNodes.forEach((node) => {
        setNodeExecutionData(node.id, {
          input: null,
          output: { items: [], error: error instanceof Error ? error.message : 'Unknown error' },
          status: 'error',
          endTime: Date.now(),
        });
      });

      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Workflow execution failed', {
        description: message,
      });
      throw error;
    }
  };

  return {
    executeWorkflow,
    isExecuting: runMutation.isPending || runAdhocMutation.isPending,
  };
}

/**
 * Hook for toggling workflow active state
 */
export function useToggleWorkflowActive() {
  const { workflowId, setIsActive } = useWorkflowStore();
  const setActiveMutation = trpc.workflows.setActive.useMutation();

  const toggleActive = async (active: boolean) => {
    if (!workflowId) {
      toast.error('Save workflow first', {
        description: 'You need to save the workflow before activating it.',
      });
      return;
    }

    try {
      const result = await setActiveMutation.mutateAsync({
        id: workflowId,
        active,
      });
      setIsActive(result.active);
      toast.success(active ? 'Workflow activated' : 'Workflow deactivated');
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to update workflow status', {
        description: message,
      });
      throw error;
    }
  };

  return {
    toggleActive,
    isToggling: setActiveMutation.isPending,
  };
}

/**
 * Hook for deleting a workflow
 */
export function useDeleteWorkflow() {
  const deleteMutation = trpc.workflows.delete.useMutation();

  const deleteWorkflow = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success('Workflow deleted');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to delete workflow', {
        description: message,
      });
      throw error;
    }
  };

  return {
    deleteWorkflow,
    isDeleting: deleteMutation.isPending,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find the source node name that provides input to a target node
 */
function findInputNode(
  targetNodeName: string,
  edges: { source: string; target: string }[],
  nodes: Node<WorkflowNodeData>[]
): string | null {
  // Create maps for ID <-> name conversion
  const idToName = new Map<string, string>();
  const nameToId = new Map<string, string>();
  nodes.forEach((node) => {
    const data = node.data as WorkflowNodeData;
    idToName.set(node.id, data.name);
    nameToId.set(data.name, node.id);
  });

  // Find the target node's ID from its name
  const targetNodeId = nameToId.get(targetNodeName);
  if (!targetNodeId) return null;

  // Find edge that targets this node
  for (const edge of edges) {
    if (edge.target === targetNodeId) {
      // Return the source node's name
      return idToName.get(edge.source) || null;
    }
  }

  return null;
}

/**
 * Normalize backend output data to display format
 */
function normalizeOutputData(data: unknown): Record<string, unknown>[] {
  if (!data) return [];

  // Backend returns: [{ json: {...} }, { json: {...} }]
  if (Array.isArray(data)) {
    return data.map((item) => {
      if (item && typeof item === 'object' && 'json' in item) {
        return item.json as Record<string, unknown>;
      }
      return item as Record<string, unknown>;
    });
  }

  // Single object
  if (typeof data === 'object') {
    return [data as Record<string, unknown>];
  }

  return [];
}
