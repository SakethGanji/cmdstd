import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type OnConnect,
  type Connection,
  Panel,
  BackgroundVariant,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Play, Loader2, Square } from 'lucide-react';

import { useWorkflowStore } from '../../stores/workflowStore';
import { useNodeCreatorStore } from '../../stores/nodeCreatorStore';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useSaveWorkflow } from '@/hooks/useWorkflowApi';
import { useExecutionStream } from '@/hooks/useExecutionStream';
import AddNodesButton from './nodes/AddNodesButton';
import WorkflowNode from './nodes/WorkflowNode';
import WorkflowEdge from './edges/WorkflowEdge';
import StickyNote from './nodes/StickyNote';
import { getNodeGroupFromType, getMiniMapColor } from '../../lib/nodeStyles';

// Define custom node types - use 'any' to work around React 19 type incompatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: any = {
  addNodes: AddNodesButton,
  workflowNode: WorkflowNode,
  stickyNote: StickyNote,
};

// Define custom edge types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes: any = {
  workflowEdge: WorkflowEdge,
};

export default function WorkflowCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNode,
    isValidConnection,
  } = useWorkflowStore();

  const openPanel = useNodeCreatorStore((s) => s.openPanel);
  const { fitView } = useReactFlow();

  const { saveWorkflow } = useSaveWorkflow();
  const { executeWorkflow, isExecuting, progress, cancelExecution } = useExecutionStream();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    onSave: () => {
      saveWorkflow();
    },
  });

  // Fit view on initial load when nodes change from placeholder to real nodes
  useEffect(() => {
    const hasRealNodes = nodes.some((n) => n.type === 'workflowNode');
    if (hasRealNodes) {
      // Small delay to ensure nodes are rendered
      const timer = setTimeout(() => {
        fitView({ padding: 0.2, duration: 200, maxZoom: 1 });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [nodes.length > 1]); // Only trigger when we go from 1 node to more

  const handleConnect: OnConnect = useCallback(
    (connection) => {
      onConnect(connection);
    },
    [onConnect]
  );

  // Connection validation callback for ReactFlow
  const handleIsValidConnection = useCallback(
    (connection: Connection) => {
      return isValidConnection(connection);
    },
    [isValidConnection]
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: { id: string }[] }) => {
      if (selectedNodes.length === 1) {
        setSelectedNode(selectedNodes[0].id);
      } else {
        setSelectedNode(null);
      }
    },
    [setSelectedNode]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  // Check if canvas is empty (only has placeholder)
  const isEmpty = useMemo(
    () => nodes.length === 1 && nodes[0].type === 'addNodes',
    [nodes]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onSelectionChange={handleSelectionChange}
        onPaneClick={handlePaneClick}
        isValidConnection={handleIsValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: 'workflowEdge',
        }}
        fitView
        fitViewOptions={{
          padding: 0.2,
          maxZoom: 1,
        }}
        snapToGrid
        snapGrid={[20, 20]}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
        panOnScroll={false}
        zoomOnScroll
        panOnDrag={true}
        selectionOnDrag={false}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        <Background
          id="grid-1"
          variant={BackgroundVariant.Dots}
          gap={20}
          size={2}
          className="text-muted-foreground/30 [&>pattern>circle]:fill-current"
        />
        <Background
          id="grid-2"
          variant={BackgroundVariant.Lines}
          gap={100}
          className="text-border/40 [&>pattern>path]:stroke-current"
        />

        {/* Controls moved to left and styled for dark mode */}
        <Controls
          position="top-left"
          showInteractive={false}
          className="!bg-card !shadow-md !rounded-lg !border !border-border text-foreground [&>button]:!bg-transparent [&>button]:!border-none [&>button]:!text-foreground [&>button:hover]:!bg-accent [&_path]:!fill-current"
        />

        {/* MiniMap - colored by node group */}
        <MiniMap
          position="bottom-left"
          nodeColor={(node) => {
            if (node.type === 'addNodes') return 'var(--muted)';
            if (node.type === 'stickyNote') {
              const color = node.data?.color || 'yellow';
              const colors: Record<string, string> = {
                yellow: '#fef08a',
                blue: '#93c5fd',
                green: '#86efac',
                pink: '#f9a8d4',
                purple: '#c4b5fd',
              };
              return colors[color] || colors.yellow;
            }
            // Get group-based color for workflow nodes
            const nodeGroup = getNodeGroupFromType(
              node.data?.type || '',
              node.data?.group ? [node.data.group] : undefined
            );
            return getMiniMapColor(nodeGroup);
          }}
          maskColor="hsl(var(--background) / 0.8)"
          className="!bg-card !shadow-md !rounded-lg !border !border-border"
        />

        {/* Status Panel */}
        <Panel position="bottom-right" className="flex items-center gap-4">
          {/* Test Workflow Button */}
          {!isEmpty && (
            <div className="flex items-center gap-2">
              {isExecuting && (
                <button
                  onClick={cancelExecution}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive text-destructive-foreground font-medium text-sm shadow-md hover:bg-destructive/90 transition-colors"
                >
                  <Square size={14} />
                  Stop
                </button>
              )}
              <button
                onClick={() => executeWorkflow()}
                disabled={isExecuting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm shadow-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isExecuting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {progress ? `${progress.completed}/${progress.total}` : 'Running...'}
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Test Workflow
                  </>
                )}
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card/80 backdrop-blur-sm border border-border/50 text-xs font-medium text-muted-foreground shadow-sm">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full ${isExecuting ? 'bg-amber-400 animate-ping' : 'bg-green-400 animate-ping'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isExecuting ? 'bg-amber-500' : 'bg-green-500'}`}></span>
              </span>
              {isExecuting ? 'Executing' : 'Ready'}
            </div>
            <div className="w-px h-3 bg-border"></div>
            <div>
              {nodes.filter(n => n.type === 'workflowNode').length} Node{nodes.filter(n => n.type === 'workflowNode').length !== 1 && 's'}
            </div>
            <div className="w-px h-3 bg-border"></div>
            <div>
              {edges.length} Edge{edges.length !== 1 && 's'}
            </div>
          </div>
        </Panel>

      </ReactFlow>

      {/* Add node button - positioned outside ReactFlow for reliable click handling */}
      {!isEmpty && (
        <button
          onClick={() => openPanel('regular')}
          className="fixed top-4 right-4 z-40 flex items-center justify-center size-9 rounded-lg bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        </button>
      )}
    </div>
  );
}
