import { useState, useMemo } from 'react';
import { Database, Code, List, ChevronDown } from 'lucide-react';
import type { NodeExecutionData } from '../../types/workflow';
import { useWorkflowStore } from '../../stores/workflowStore';
import RunDataDisplay from './RunDataDisplay';

interface InputPanelProps {
  nodeId: string;
  executionData: NodeExecutionData | null;
}

type DisplayMode = 'table' | 'json' | 'schema';

export default function InputPanel({ nodeId, executionData }: InputPanelProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('table');

  // Get edges and execution data from store to find upstream node's output
  const { edges, executionData: allExecutionData, nodes } = useWorkflowStore();

  // Find the upstream node connected to this node
  const upstreamData = useMemo(() => {
    // First, try to use the node's own input data (set during execution)
    if (executionData?.input?.items && executionData.input.items.length > 0) {
      return executionData.input;
    }

    // Otherwise, find the upstream node and get its output
    const incomingEdge = edges.find((e) => e.target === nodeId);
    if (!incomingEdge) return null;

    const upstreamNodeExecution = allExecutionData[incomingEdge.source];
    if (upstreamNodeExecution?.output?.items && upstreamNodeExecution.output.items.length > 0) {
      return upstreamNodeExecution.output;
    }

    return null;
  }, [nodeId, executionData, edges, allExecutionData]);

  // Find upstream node name for display
  const upstreamNodeName = useMemo(() => {
    const incomingEdge = edges.find((e) => e.target === nodeId);
    if (!incomingEdge) return null;
    const upstreamNode = nodes.find((n) => n.id === incomingEdge.source);
    return upstreamNode?.data?.label || upstreamNode?.data?.name || null;
  }, [nodeId, edges, nodes]);

  const hasData = upstreamData?.items && upstreamData.items.length > 0;

  return (
    <div className="flex h-full flex-col bg-muted">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Input</h3>
          {hasData && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {upstreamData?.items?.length} items
            </span>
          )}
        </div>

        {/* Display mode toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setDisplayMode('table')}
            className={`rounded p-1.5 ${
              displayMode === 'table'
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Table view"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setDisplayMode('json')}
            className={`rounded p-1.5 ${
              displayMode === 'json'
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="JSON view"
          >
            <Code size={16} />
          </button>
          <button
            onClick={() => setDisplayMode('schema')}
            className={`rounded p-1.5 ${
              displayMode === 'schema'
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Schema view"
          >
            <Database size={16} />
          </button>
        </div>
      </div>

      {/* Source node indicator */}
      <div className="border-b border-border bg-card px-4 py-2">
        <div className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm">
          {upstreamNodeName ? (
            <span className="text-foreground font-medium">
              From: {upstreamNodeName}
            </span>
          ) : (
            <span className="text-muted-foreground">No connected input</span>
          )}
          <ChevronDown size={16} className="text-muted-foreground" />
        </div>
      </div>

      {/* Data display */}
      <div className="flex-1 overflow-auto p-4">
        {executionData?.status === 'running' ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : hasData ? (
          <RunDataDisplay
            data={upstreamData!.items}
            mode={displayMode}
          />
        ) : upstreamNodeName ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Database size={48} className="mb-4 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              No data from {upstreamNodeName}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Execute the upstream node to see input data
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Database size={48} className="mb-4 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              No connected input
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect a node to see its output as input here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
