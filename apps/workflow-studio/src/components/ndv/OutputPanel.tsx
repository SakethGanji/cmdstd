import { useState } from 'react';
import { Database, Code, List, Pin, Clock } from 'lucide-react';
import type { NodeExecutionData } from '../../types/workflow';
import { useWorkflowStore } from '../../stores/workflowStore';
import RunDataDisplay from './RunDataDisplay';

interface OutputPanelProps {
  nodeId: string;
  executionData: NodeExecutionData | null;
}

type DisplayMode = 'table' | 'json' | 'schema';

export default function OutputPanel({ nodeId, executionData }: OutputPanelProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('table');

  const hasPinned = useWorkflowStore((s) => s.hasPinnedData(nodeId));
  const getPinnedDataForDisplay = useWorkflowStore((s) => s.getPinnedDataForDisplay);
  const pinNodeData = useWorkflowStore((s) => s.pinNodeData);
  const unpinNodeData = useWorkflowStore((s) => s.unpinNodeData);

  const isPinned = hasPinned;

  // Use pinned data if available, otherwise use execution data
  // getPinnedDataForDisplay unwraps { json: {...} } to just {...}
  const displayData = isPinned
    ? getPinnedDataForDisplay(nodeId)
    : executionData?.output?.items;

  const handlePinToggle = () => {
    if (isPinned) {
      unpinNodeData(nodeId);
    } else if (executionData?.output?.items && executionData.output.items.length > 0) {
      // Convert to backend format: { json: {...} }[]
      const backendFormat = executionData.output.items.map((item) => ({
        json: item as Record<string, unknown>,
      }));
      pinNodeData(nodeId, backendFormat);
    }
  };

  const hasData = executionData?.output?.items && executionData.output.items.length > 0;
  const hasError = executionData?.output?.error;

  // Calculate execution time
  const executionTime = executionData?.startTime && executionData?.endTime
    ? `${((executionData.endTime - executionData.startTime) / 1000).toFixed(2)}s`
    : null;

  return (
    <div className="flex h-full flex-col bg-muted">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Output</h3>
          {hasData && (
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
              {executionData?.output?.items.length} items
            </span>
          )}
          {hasError && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
              Error
            </span>
          )}
          {executionTime && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={12} />
              {executionTime}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Pin button */}
          <button
            onClick={handlePinToggle}
            disabled={!hasData && !isPinned}
            className={`rounded p-1.5 ${
              isPinned
                ? 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
            title={isPinned ? 'Unpin data' : 'Pin data'}
          >
            <Pin size={16} />
          </button>

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
      </div>

      {/* Pinned indicator */}
      {isPinned && (
        <div className="flex items-center gap-2 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
          <Pin size={12} />
          This output data is pinned
        </div>
      )}

      {/* Data display */}
      <div className="flex-1 overflow-auto p-4">
        {!executionData ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Database size={48} className="mb-4 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              No output data yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Execute the node to see output
            </p>
          </div>
        ) : executionData.status === 'running' ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Executing node...</p>
          </div>
        ) : hasError ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="font-medium text-destructive">Execution Error</p>
            <p className="mt-1 text-sm text-destructive/80">
              {executionData.output?.error}
            </p>
          </div>
        ) : displayData && displayData.length > 0 ? (
          <RunDataDisplay
            data={displayData}
            mode={displayMode}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Database size={48} className="mb-4 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              No output items
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
