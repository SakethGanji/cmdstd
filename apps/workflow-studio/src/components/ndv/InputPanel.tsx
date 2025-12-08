import { useState, useMemo } from 'react';
import { Database, Code, ArrowDown } from 'lucide-react';
import type { NodeExecutionData } from '../../types/workflow';
import { useWorkflowStore } from '../../stores/workflowStore';
import RunDataDisplay from './RunDataDisplay';

interface InputPanelProps {
  nodeId: string;
  executionData: NodeExecutionData | null;
}

type DisplayMode = 'json' | 'schema';

export default function InputPanel({ nodeId, executionData }: InputPanelProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('schema');

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
  const itemCount = upstreamData?.items?.length ?? 0;

  return (
    <div className="flex h-full flex-col bg-muted/50">
      {/* Compact Header - Source + View Toggle inline */}
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <ArrowDown size={14} className="text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">
            {upstreamNodeName || 'Input'}
          </span>
          {hasData && (
            <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {itemCount}
            </span>
          )}
        </div>

        {/* Display mode toggle - compact */}
        <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
          <button
            onClick={() => setDisplayMode('schema')}
            className={`rounded p-1 transition-colors ${
              displayMode === 'schema'
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Schema view"
          >
            <Database size={14} />
          </button>
          <button
            onClick={() => setDisplayMode('json')}
            className={`rounded p-1 transition-colors ${
              displayMode === 'json'
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="JSON view"
          >
            <Code size={14} />
          </button>
        </div>
      </div>

      {/* Data display */}
      <div className="flex-1 overflow-auto p-2">
        {executionData?.status === 'running' ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : hasData ? (
          <RunDataDisplay
            data={upstreamData!.items}
            mode={displayMode}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center px-4">
            <Database size={32} className="mb-2 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {upstreamNodeName
                ? `No data from ${upstreamNodeName}`
                : 'No connected input'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
