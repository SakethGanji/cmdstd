import { useCallback, useEffect } from 'react';
import { X, ArrowLeft, Play, Trash2 } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { useNDVStore } from '../../stores/ndvStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import InputPanel from './InputPanel';
import OutputPanel from './OutputPanel';
import NodeSettings from './NodeSettings';

export default function NodeDetailsModal() {
  const { isOpen, activeNodeId, closeNDV } = useNDVStore();
  const { nodes, deleteNode, executionData, setNodeExecutionData } = useWorkflowStore();

  // Find the active node
  const activeNode = nodes.find((n) => n.id === activeNodeId);
  const nodeExecution = activeNodeId ? executionData[activeNodeId] : null;

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeNDV();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeNDV]);

  // Simulate node execution (UI only for now)
  const handleExecute = useCallback(() => {
    if (!activeNodeId) return;

    // Set running state
    setNodeExecutionData(activeNodeId, {
      input: null,
      output: null,
      status: 'running',
      startTime: Date.now(),
    });

    // Simulate execution after delay
    setTimeout(() => {
      setNodeExecutionData(activeNodeId, {
        input: {
          items: [
            { id: 1, name: 'Item 1', value: 100 },
            { id: 2, name: 'Item 2', value: 200 },
          ],
        },
        output: {
          items: [
            { id: 1, name: 'Item 1', value: 100, processed: true },
            { id: 2, name: 'Item 2', value: 200, processed: true },
          ],
        },
        status: 'success',
        startTime: Date.now() - 1000,
        endTime: Date.now(),
      });
    }, 1500);
  }, [activeNodeId, setNodeExecutionData]);

  const handleDelete = useCallback(() => {
    if (!activeNodeId) return;
    deleteNode(activeNodeId);
    closeNDV();
  }, [activeNodeId, deleteNode, closeNDV]);

  if (!isOpen || !activeNode) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={closeNDV}
      />

      {/* Modal */}
      <div className="relative z-10 flex h-[90vh] w-[95vw] max-w-[1600px] flex-col overflow-hidden rounded-xl bg-card shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={closeNDV}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
            >
              <ArrowLeft size={16} />
              Back to canvas
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">
              {activeNode.data.label}
            </span>
            {nodeExecution?.status === 'running' && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                Running...
              </span>
            )}
            {nodeExecution?.status === 'success' && (
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Success
              </span>
            )}
            {nodeExecution?.status === 'error' && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                Error
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExecute}
              disabled={nodeExecution?.status === 'running'}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Play size={16} />
              Test step
            </button>
            <button
              onClick={handleDelete}
              className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={closeNDV}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Three Panel Layout */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal">
            {/* Input Panel */}
            <Panel defaultSize={25} minSize={15} maxSize={40}>
              <InputPanel
                nodeId={activeNodeId!}
                executionData={nodeExecution}
              />
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />

            {/* Settings Panel */}
            <Panel defaultSize={50} minSize={30}>
              <NodeSettings
                node={activeNode}
                onExecute={handleExecute}
              />
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />

            {/* Output Panel */}
            <Panel defaultSize={25} minSize={15} maxSize={40}>
              <OutputPanel
                nodeId={activeNodeId!}
                executionData={nodeExecution}
              />
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </div>
  );
}
