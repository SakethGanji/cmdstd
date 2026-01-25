/**
 * Execution Logs Panel
 *
 * A minimal corner icon that expands into a panel when clicked.
 * Shows execution status at a glance.
 */

import { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ScrollText,
  ChevronUp,
} from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { cn } from '@/shared/lib/utils';

interface ExecutionLog {
  id: string;
  nodeName: string;
  nodeLabel: string;
  status: 'idle' | 'running' | 'success' | 'error';
  timestamp: number;
  duration?: number;
  itemCount?: number;
  error?: string;
}

export default function ExecutionLogsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const { executionData, nodes, edges, clearExecutionData } = useWorkflowStore();

  // Convert execution data to logs format
  const logs: ExecutionLog[] = Object.entries(executionData)
    .map(([nodeId, data]): ExecutionLog | null => {
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
  const allSuccess = hasLogs && !isRunning && !hasErrors;
  const totalDuration = logs.reduce((sum, l) => sum + (l.duration || 0), 0);

  const selectedLog = selectedLogId
    ? logs.find((l) => l.id === selectedLogId)
    : null;
  const selectedNodeData = selectedLogId ? executionData[selectedLogId] : null;

  // Auto-select first log when execution starts
  useEffect(() => {
    if (hasLogs && !selectedLogId) {
      setSelectedLogId(logs[0]?.id || null);
    }
  }, [hasLogs, logs, selectedLogId]);

  const handleClear = () => {
    clearExecutionData();
    setSelectedLogId(null);
    setIsExpanded(false);
  };

  const nodeCount = nodes.filter(n => n.type === 'workflowNode').length;

  // Collapsed state - combined status bar in bottom-right corner
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={cn(
          'absolute bottom-4 right-4 z-30',
          'flex items-center gap-2 px-3 py-1.5 rounded-xl',
          'bg-white dark:bg-card shadow-lg text-xs',
          'transition-all hover:shadow-xl cursor-pointer'
        )}
        title="Click to view execution logs"
      >
        {/* Node/Edge count */}
        <span className="text-muted-foreground font-medium">{nodeCount} nodes</span>
        <div className="w-px h-3 bg-border" />
        <span className="text-muted-foreground font-medium">{edges.length} edges</span>

        {/* Divider */}
        <div className="w-px h-3 bg-border" />

        {/* Logs status */}
        <div className="flex items-center gap-1.5">
          {isRunning ? (
            <Loader2 size={14} className="animate-spin text-amber-500" />
          ) : hasErrors ? (
            <XCircle size={14} className="text-destructive" />
          ) : allSuccess ? (
            <CheckCircle2 size={14} className="text-emerald-500" />
          ) : (
            <ScrollText size={14} className="text-muted-foreground" />
          )}
          <span className="font-medium text-muted-foreground">Logs</span>
          {hasLogs && (
            <span className={cn(
              'font-medium',
              isRunning && 'text-amber-600 dark:text-amber-400',
              hasErrors && 'text-destructive',
              allSuccess && 'text-emerald-600 dark:text-emerald-400'
            )}>
              {isRunning ? 'Running...' : hasErrors ? 'Failed' : `${totalDuration}ms`}
            </span>
          )}
          <ChevronUp size={14} className="text-muted-foreground" />
        </div>
      </button>
    );
  }

  // Expanded state - panel anchored to bottom-right
  return (
    <div
      className={cn(
        'absolute bottom-4 right-4 z-30',
        'w-[560px] max-w-[calc(100vw-2rem)] h-72 bg-white dark:bg-card rounded-xl flex flex-col',
        'shadow-2xl'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-10 px-3 border-b border-border bg-muted/50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Logs</span>
          {hasLogs && (
            <>
              <div className="w-px h-4 bg-border" />
              {isRunning ? (
                <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <Loader2 size={12} className="animate-spin" />
                  Running
                </span>
              ) : hasErrors ? (
                <span className="flex items-center gap-1.5 text-xs text-destructive">
                  <XCircle size={12} />
                  Failed
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={12} />
                  {totalDuration}ms
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            disabled={!hasLogs}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear logs"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Node list */}
        <div className="w-44 border-r border-border overflow-y-auto bg-muted/30 rounded-bl-xl">
          {!hasLogs ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-3">
              <ScrollText size={20} className="text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">No logs yet</p>
            </div>
          ) : (
            <div className="p-1.5 space-y-0.5">
              {logs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => setSelectedLogId(log.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors',
                    selectedLogId === log.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-accent text-foreground'
                  )}
                >
                  {log.status === 'running' && (
                    <Loader2
                      size={12}
                      className="animate-spin text-amber-500 flex-shrink-0"
                    />
                  )}
                  {log.status === 'success' && (
                    <CheckCircle2
                      size={12}
                      className="text-emerald-500 flex-shrink-0"
                    />
                  )}
                  {log.status === 'error' && (
                    <XCircle size={12} className="text-destructive flex-shrink-0" />
                  )}
                  <span className="text-xs truncate flex-1">{log.nodeLabel}</span>
                  {log.duration !== undefined && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {log.duration}ms
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Output preview */}
        <div className="flex-1 overflow-auto p-3 bg-background/50 rounded-br-xl">
          {selectedLog && selectedNodeData ? (
            <div className="space-y-2">
              {/* Node header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground">
                    {selectedLog.nodeLabel}
                  </h3>
                  {selectedLog.status === 'success' && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                      Success
                    </span>
                  )}
                  {selectedLog.status === 'error' && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-destructive/10 text-destructive">
                      Error
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {selectedLog.duration !== undefined && (
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
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
                <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-xs text-destructive">{selectedLog.error}</p>
                </div>
              )}

              {/* Output data */}
              {selectedNodeData.output?.items &&
                selectedNodeData.output.items.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Output
                    </h4>
                    <pre className="p-2 rounded-lg bg-muted text-[11px] overflow-auto max-h-40 font-mono">
                      {JSON.stringify(selectedNodeData.output.items, null, 2)}
                    </pre>
                  </div>
                )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-xs text-muted-foreground">
                {hasLogs
                  ? 'Select a node to view output'
                  : 'Run workflow to see logs'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
