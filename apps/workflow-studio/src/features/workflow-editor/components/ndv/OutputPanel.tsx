import { useState, useMemo } from 'react';
import { Database, Code, Pin, Clock, ArrowUp, Eye } from 'lucide-react';
import type { NodeExecutionData } from '../../types/workflow';
import { useWorkflowStore } from '../../stores/workflowStore';
import RunDataDisplay from './RunDataDisplay';
import HTMLPreviewModal from './HTMLPreviewModal';

interface OutputPanelProps {
  nodeId: string;
  executionData: NodeExecutionData | null;
}

type DisplayMode = 'json' | 'schema';

export default function OutputPanel({ nodeId, executionData }: OutputPanelProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('schema');
  const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);

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

  // Check if data contains HTML content (marked with _renderAs: 'html')
  const htmlContent = useMemo(() => {
    if (!displayData || displayData.length === 0) return null;
    const firstItem = displayData[0] as Record<string, unknown>;
    if (firstItem?._renderAs === 'html' && typeof firstItem?.html === 'string') {
      return firstItem.html;
    }
    return null;
  }, [displayData]);

  const hasHtmlContent = htmlContent !== null;

  // Calculate execution time
  const executionTime = executionData?.startTime && executionData?.endTime
    ? `${((executionData.endTime - executionData.startTime) / 1000).toFixed(2)}s`
    : null;

  return (
    <div className="flex h-full flex-col bg-muted/50">
      {/* Compact Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <ArrowUp size={14} className="text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium text-foreground">Output</span>
          {hasData && (
            <span className="flex-shrink-0 rounded bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
              {itemCount}
            </span>
          )}
          {hasError && (
            <span className="flex-shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
              Error
            </span>
          )}
          {executionTime && (
            <span className="flex-shrink-0 flex items-center gap-0.5 text-xs text-muted-foreground">
              <Clock size={10} />
              {executionTime}
            </span>
          )}
          {isPinned && (
            <span className="flex-shrink-0 rounded bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
              Pinned
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* View HTML button - only shown when HTML content is present */}
          {hasHtmlContent && (
            <button
              onClick={() => setIsHtmlModalOpen(true)}
              className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              title="View HTML"
            >
              <Eye size={12} />
              <span>View HTML</span>
            </button>
          )}

          {/* Pin button */}
          <button
            onClick={handlePinToggle}
            disabled={!hasData && !isPinned}
            className={`rounded p-1 transition-colors ${
              isPinned
                ? 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
            title={isPinned ? 'Unpin data' : 'Pin data'}
          >
            <Pin size={14} />
          </button>

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
      </div>

      {/* Data display */}
      <div className="flex-1 overflow-auto p-2">
        {!executionData ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-4">
            <Database size={32} className="mb-2 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              No output data yet
            </p>
          </div>
        ) : executionData.status === 'running' ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
            <p className="mt-2 text-xs text-muted-foreground">Executing...</p>
          </div>
        ) : hasError ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="mt-1 text-xs text-destructive/80">
              {executionData.output?.error}
            </p>
          </div>
        ) : displayData && displayData.length > 0 ? (
          <RunDataDisplay
            data={displayData}
            mode={displayMode}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center px-4">
            <Database size={32} className="mb-2 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              No output items
            </p>
          </div>
        )}
      </div>

      {/* HTML Preview Modal */}
      {htmlContent && (
        <HTMLPreviewModal
          html={htmlContent}
          isOpen={isHtmlModalOpen}
          onClose={() => setIsHtmlModalOpen(false)}
        />
      )}
    </div>
  );
}
