/**
 * Execution Logs Panel
 *
 * A collapsible floating panel at the bottom of the canvas that shows
 * workflow execution logs similar to n8n's design.
 */

import { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Play,
} from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { cn } from '@/lib/utils';

interface ExecutionLog {
  id: string;
  nodeName: string;
  nodeLabel: string;
  status: 'running' | 'success' | 'error';
  timestamp: number;
  duration?: number;
  itemCount?: number;
  error?: string;
}

export default function ExecutionLogsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const { executionData, nodes, clearExecutionData } = useWorkflowStore();

  // Convert execution data to logs format
  const logs: ExecutionLog[] = Object.entries(executionData)
    .map(([nodeId, data]) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || node.type !== 'workflowNode') return null;

      return {
        id: nodeId,
        nodeName: node.data.name || nodeId,
        nodeLabel: node.data.label || node.data.name || 'Unknown',
        status: data.status,
        timestamp: data.startTime || Date.now(),
        duration:
          data.startTime && data.endTime
            ? data.endTime - data.startTime
            : undefined,
        itemCount: data.output?.items?.length,
        error: data.output?.error,
      };
    })
    .filter((log): log is ExecutionLog => log !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  const hasLogs = logs.length > 0;
  const isRunning = logs.some((l) => l.status === 'running');
  const hasErrors = logs.some((l) => l.status === 'error');
  const totalDuration = logs.reduce((sum, l) => sum + (l.duration || 0), 0);

  const selectedLog = selectedLogId
    ? logs.find((l) => l.id === selectedLogId)
    : null;
  const selectedNodeData = selectedLogId ? executionData[selectedLogId] : null;

  const handleClear = () => {
    clearExecutionData();
    setSelectedLogId(null);
  };

  // Collapsed state - floating pill at bottom
  if (!isExpanded) {
    return (
      <div
        className={cn(
          'absolute bottom-4 left-1/2 -translate-x-1/2 z-30',
          'flex items-center gap-3 px-4 py-2 cursor-pointer',
          'bg-card/95 backdrop-blur-sm border border-border rounded-full shadow-lg',
          'hover:bg-accent/50 hover:shadow-xl transition-all'
        )}
        onClick={() => setIsExpanded(true)}
      >
        <ChevronUp size={16} className="text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Logs</span>
        {hasLogs && (
          <>
            <div className="w-px h-4 bg-border" />
            {isRunning ? (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <Loader2 size={12} className="animate-spin" />
                Running...
              </span>
            ) : hasErrors ? (
              <span className="flex items-center gap-1.5 text-xs text-destructive">
                <XCircle size={12} />
                Failed
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={12} />
                Success in {totalDuration}ms
              </span>
            )}
            <div className="w-px h-4 bg-border" />
            <span className="text-xs text-muted-foreground">
              {logs.length} node{logs.length !== 1 && 's'}
            </span>
          </>
        )}
      </div>
    );
  }

  // Expanded state - floating panel
  return (
    <div
      className={cn(
        'absolute bottom-4 left-4 right-4 z-30',
        'h-72 bg-card/95 backdrop-blur-sm border border-border rounded-xl flex flex-col',
        'shadow-2xl'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-10 px-4 border-b border-border bg-muted/50 rounded-t-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 rounded hover:bg-accent text-muted-foreground"
          >
            <ChevronDown size={16} />
          </button>
          <span className="text-sm font-medium text-foreground">Logs</span>
          {hasLogs && (
            <>
              <div className="w-px h-4 bg-border" />
              {isRunning ? (
                <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <Loader2 size={12} className="animate-spin" />
                  Running...
                </span>
              ) : hasErrors ? (
                <span className="flex items-center gap-1.5 text-xs text-destructive">
                  <XCircle size={12} />
                  Execution failed
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={12} />
                  Success in {totalDuration}ms
                </span>
              )}
            </>
          )}
        </div>
        <button
          onClick={handleClear}
          disabled={!hasLogs}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={12} />
          Clear execution
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Node list */}
        <div className="w-64 border-r border-border overflow-y-auto bg-muted/30 rounded-bl-xl">
          {!hasLogs ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <Play size={24} className="text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No execution data</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Run the workflow to see logs
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {logs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => setSelectedLogId(log.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors',
                    selectedLogId === log.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-accent text-foreground'
                  )}
                >
                  {log.status === 'running' && (
                    <Loader2
                      size={14}
                      className="animate-spin text-amber-500 flex-shrink-0"
                    />
                  )}
                  {log.status === 'success' && (
                    <CheckCircle2
                      size={14}
                      className="text-emerald-500 flex-shrink-0"
                    />
                  )}
                  {log.status === 'error' && (
                    <XCircle size={14} className="text-destructive flex-shrink-0" />
                  )}
                  <span className="text-sm truncate flex-1">{log.nodeLabel}</span>
                  {log.duration !== undefined && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {log.duration}ms
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Output preview */}
        <div className="flex-1 overflow-auto p-4 bg-background/50 rounded-br-xl">
          {selectedLog && selectedNodeData ? (
            <div className="space-y-3">
              {/* Node header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground">
                    {selectedLog.nodeLabel}
                  </h3>
                  {selectedLog.status === 'success' && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                      Success
                    </span>
                  )}
                  {selectedLog.status === 'error' && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-destructive/10 text-destructive">
                      Error
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {selectedLog.duration !== undefined && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {selectedLog.duration}ms
                    </span>
                  )}
                  {selectedLog.itemCount !== undefined && (
                    <span>{selectedLog.itemCount} item{selectedLog.itemCount !== 1 && 's'}</span>
                  )}
                </div>
              </div>

              {/* Error message */}
              {selectedLog.error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{selectedLog.error}</p>
                </div>
              )}

              {/* Output data */}
              {selectedNodeData.output?.items &&
                selectedNodeData.output.items.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Output
                    </h4>
                    <pre className="p-3 rounded-lg bg-muted text-xs overflow-auto max-h-32 font-mono">
                      {JSON.stringify(selectedNodeData.output.items, null, 2)}
                    </pre>
                  </div>
                )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-muted-foreground">
                {hasLogs
                  ? 'Select a node to view output'
                  : 'Execute the workflow to see logs'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
