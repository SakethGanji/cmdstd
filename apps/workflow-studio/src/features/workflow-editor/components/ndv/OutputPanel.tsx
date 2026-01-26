import { useState } from 'react';
import { Database, Code, Pin, Clock, ArrowUp } from 'lucide-react';
import type { NodeExecutionData } from '../../types/workflow';
import { useWorkflowStore } from '../../stores/workflowStore';
import RunDataDisplay from './RunDataDisplay';

interface OutputPanelProps {
  nodeId: string;
  executionData: NodeExecutionData | null;
}

type DisplayMode = 'json' | 'schema';

export default function OutputPanel({ nodeId, executionData }: OutputPanelProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('schema');

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
  const itemCount = executionData?.output?.items?.length ?? 0;

  // Calculate execution time
  const executionTime = executionData?.startTime && executionData?.endTime
    ? `${((executionData.endTime - executionData.startTime) / 1000).toFixed(2)}s`
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-[var(--card-gradient)] px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[var(--success)]/10 flex items-center justify-center">
            <ArrowUp size={14} className="text-[var(--success)]" />
          </div>
          <span className="text-sm font-bold text-foreground">Output</span>
          {hasData && (
            <span className="glass-badge bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20">
              {itemCount} items
            </span>
          )}
          {hasError && (
            <span className="glass-badge bg-destructive/10 text-destructive border-destructive/20">
              Error
            </span>
          )}
          {executionTime && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={12} />
              {executionTime}
            </span>
          )}
          {isPinned && (
            <span className="glass-badge bg-amber-500/10 text-amber-500 border-amber-500/20">
              Pinned
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Pin button */}
          <button
            onClick={handlePinToggle}
            disabled={!hasData && !isPinned}
            className={`rounded-xl p-2 transition-all ${
              isPinned
                ? 'bg-amber-500/10 text-amber-500'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
            title={isPinned ? 'Unpin data' : 'Pin data'}
          >
            <Pin size={14} />
          </button>

          {/* Display mode toggle */}
          <div className="glass-toggle-group flex items-center">
            <button
              onClick={() => setDisplayMode('schema')}
              className={`rounded-lg p-2 transition-all ${
                displayMode === 'schema'
                  ? 'bg-[var(--card-solid)] shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Schema view"
            >
              <Database size={14} />
            </button>
            <button
              onClick={() => setDisplayMode('json')}
              className={`rounded-lg p-2 transition-all ${
                displayMode === 'json'
                  ? 'bg-[var(--card-solid)] shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="JSON view"
            >
              <Code size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Data display */}
      <div className="flex-1 overflow-auto p-3">
        {!executionData ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Database size={24} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">
              No output data yet
            </p>
            <p className="text-xs text-muted-foreground">
              Run the workflow to see results
            </p>
          </div>
        ) : executionData.status === 'running' ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="mt-3 text-sm font-medium text-foreground">Executing...</p>
          </div>
        ) : hasError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-bold text-destructive">Error</p>
            <p className="mt-2 text-xs text-destructive/80">
              {executionData.output?.error}
            </p>
          </div>
        ) : displayData && displayData.length > 0 ? (
          <RunDataDisplay
            data={displayData}
            mode={displayMode}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Database size={24} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">
              No output items
            </p>
            <p className="text-xs text-muted-foreground">
              The node executed but returned no data
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
