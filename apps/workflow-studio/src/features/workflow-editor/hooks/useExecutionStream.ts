/**
 * SSE-based Execution Stream Hook
 *
 * Provides real-time workflow execution updates via Server-Sent Events.
 * Updates node status as each node starts/completes/fails.
 */

import { useCallback, useRef, useState } from 'react';
import { useWorkflowStore } from '../stores/workflowStore';
import { toBackendWorkflow } from '../lib/workflowTransform';
import { backends } from '@/shared/lib/config';
import { toast } from 'sonner';
import type { WorkflowNodeData } from '../types/workflow';
import type { Node } from 'reactflow';

// Event types from backend
interface ExecutionEvent {
  type:
    | 'execution:start'
    | 'node:start'
    | 'node:complete'
    | 'node:error'
    | 'execution:complete'
    | 'execution:error'
    | 'execution:result';
  executionId: string;
  timestamp: string;
  nodeName?: string;
  nodeType?: string;
  data?: Array<{ json: Record<string, unknown> }>;
  error?: string;
  progress?: {
    completed: number;
    total: number;
  };
  // For execution:result event
  status?: 'success' | 'failed';
  errors?: Array<{ nodeName: string; error: string; timestamp: string }>;
}

interface UseExecutionStreamResult {
  executeWorkflow: () => Promise<void>;
  isExecuting: boolean;
  progress: { completed: number; total: number } | null;
  cancelExecution: () => void;
}


export function useExecutionStream(): UseExecutionStreamResult {
  const {
    nodes,
    edges,
    workflowName,
    workflowId,
    setNodeExecutionData,
    clearExecutionData,
  } = useWorkflowStore();

  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Build name-to-id mapping for translating backend node names to UI node IDs
  const buildNameToIdMap = useCallback(() => {
    const map = new Map<string, string>();
    const workflowNodes = nodes.filter((n) => n.type === 'workflowNode');
    workflowNodes.forEach((node) => {
      const data = node.data as WorkflowNodeData;
      map.set(data.name, node.id);
    });
    return map;
  }, [nodes]);

  // Find the input node name for a given node
  const findInputNodeName = useCallback(
    (targetNodeName: string, nameToId: Map<string, string>) => {
      const targetNodeId = nameToId.get(targetNodeName);
      if (!targetNodeId) return null;

      for (const edge of edges) {
        if (edge.target === targetNodeId) {
          // Find the source node's name
          for (const [name, id] of nameToId) {
            if (id === edge.source) return name;
          }
        }
      }
      return null;
    },
    [edges]
  );

  const cancelExecution = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsExecuting(false);
    setProgress(null);
  }, []);

  const executeWorkflow = useCallback(async () => {
    // Clear previous execution data
    clearExecutionData();
    setIsExecuting(true);
    setProgress(null);

    // Mark all workflow nodes as pending initially
    const workflowNodes = nodes.filter((n) => n.type === 'workflowNode');
    workflowNodes.forEach((node) => {
      setNodeExecutionData(node.id, {
        input: null,
        output: null,
        status: 'idle',
      });
    });

    const nameToId = buildNameToIdMap();
    const nodeOutputs: Record<string, Array<{ json: Record<string, unknown> }>> = {};

    try {
      let url: string;

      if (workflowId) {
        // Execute saved workflow via GET
        url = `${backends.workflow}/execution-stream/${workflowId}`;
      } else {
        // Execute ad-hoc workflow via POST - need to use fetch + ReadableStream
        const backendWorkflow = toBackendWorkflow(
          nodes as Node<WorkflowNodeData>[],
          edges,
          workflowName
        );

        abortControllerRef.current = new AbortController();

        const response = await fetch(`${backends.workflow}/execution-stream/adhoc`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(backendWorkflow),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        // Process the stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              try {
                const event: ExecutionEvent = JSON.parse(jsonStr);
                handleEvent(event, nameToId, nodeOutputs, findInputNodeName);
              } catch (e) {
                console.error('Failed to parse SSE event:', e);
              }
            }
          }
        }

        setIsExecuting(false);
        setProgress(null);
        return;
      }

      // For saved workflows, use EventSource (GET request)
      eventSourceRef.current = new EventSource(url);

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data: ExecutionEvent = JSON.parse(event.data);
          handleEvent(data, nameToId, nodeOutputs, findInputNodeName);
        } catch (e) {
          console.error('Failed to parse SSE event:', e);
        }
      };

      eventSourceRef.current.onerror = (error) => {
        console.error('SSE error:', error);
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        setIsExecuting(false);
        setProgress(null);
        toast.error('Connection lost during execution');
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        toast.info('Execution cancelled');
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error('Workflow execution failed', { description: message });

        // Mark all nodes as error
        workflowNodes.forEach((node) => {
          setNodeExecutionData(node.id, {
            input: null,
            output: { items: [], error: message },
            status: 'error',
            endTime: Date.now(),
          });
        });
      }
      setIsExecuting(false);
      setProgress(null);
    }

    // Helper function to handle events
    function handleEvent(
      event: ExecutionEvent,
      nameToId: Map<string, string>,
      nodeOutputs: Record<string, Array<{ json: Record<string, unknown> }>>,
      findInputNodeName: (name: string, map: Map<string, string>) => string | null
    ) {
      switch (event.type) {
        case 'execution:start':
          setProgress(event.progress || null);
          break;

        case 'node:start': {
          const nodeId = nameToId.get(event.nodeName || '');
          if (nodeId) {
            setNodeExecutionData(nodeId, {
              input: null,
              output: null,
              status: 'running',
              startTime: Date.now(),
            });
          }
          setProgress(event.progress || null);
          break;
        }

        case 'node:complete': {
          const nodeId = nameToId.get(event.nodeName || '');
          if (nodeId && event.nodeName) {
            // Store output for later use as input to downstream nodes
            if (event.data) {
              nodeOutputs[event.nodeName] = event.data;
            }

            // Find input from upstream node
            const inputNodeName = findInputNodeName(event.nodeName, nameToId);
            const inputData = inputNodeName ? nodeOutputs[inputNodeName] : null;

            setNodeExecutionData(nodeId, {
              input: inputData ? { items: inputData.map((d) => d.json) } : null,
              output: { items: event.data?.map((d) => d.json) || [] },
              status: 'success',
              startTime: Date.now(),
              endTime: Date.now(),
            });
          }
          setProgress(event.progress || null);
          break;
        }

        case 'node:error': {
          const nodeId = nameToId.get(event.nodeName || '');
          if (nodeId) {
            setNodeExecutionData(nodeId, {
              input: null,
              output: { items: [], error: event.error },
              status: 'error',
              endTime: Date.now(),
            });
          }
          break;
        }

        case 'execution:complete':
          setProgress(event.progress || null);
          // Close EventSource if using it
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          break;

        case 'execution:result':
          // Final result with all data
          if (event.status === 'success') {
            toast.success('Workflow executed successfully', {
              description: `Execution ID: ${event.executionId}`,
            });
          } else if (event.errors && event.errors.length > 0) {
            toast.error('Workflow execution failed', {
              description: event.errors[0]?.error || 'Unknown error',
            });
          }
          setIsExecuting(false);
          setProgress(null);
          break;

        case 'execution:error':
          toast.error('Workflow execution failed', {
            description: event.error || 'Unknown error',
          });
          setIsExecuting(false);
          setProgress(null);
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          break;
      }
    }
  }, [
    nodes,
    edges,
    workflowName,
    workflowId,
    setNodeExecutionData,
    clearExecutionData,
    buildNameToIdMap,
    findInputNodeName,
  ]);

  return {
    executeWorkflow,
    isExecuting,
    progress,
    cancelExecution,
  };
}
