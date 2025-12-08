import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type OnConnect,
  type Connection,
  BackgroundVariant,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Play, Loader2, Square, Plus, Minus } from 'lucide-react';

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
import { cn } from '@/lib/utils';

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
  const { fitView, zoomIn, zoomOut } = useReactFlow();

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

      </ReactFlow>

      {/* Top-right toolbar - Zoom, Play, and Add buttons */}
      {!isEmpty && (
        <div className="fixed top-4 right-4 z-40 flex items-center gap-1.5">
          {/* Zoom controls - horizontal */}
          <div className="flex flex-row bg-card/80 backdrop-blur-sm rounded-lg border border-border/50 shadow-md overflow-hidden">
            <button
              onClick={() => zoomOut()}
              className="flex items-center justify-center h-9 w-7 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border-r border-border/50"
              title="Zoom out"
            >
              <Minus size={14} strokeWidth={2} />
            </button>
            <button
              onClick={() => zoomIn()}
              className="flex items-center justify-center h-9 w-7 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Zoom in"
            >
              <Plus size={14} strokeWidth={2} />
            </button>
          </div>

          {/* Play/Stop button */}
          {isExecuting ? (
            <button
              onClick={cancelExecution}
              className={cn(
                "flex items-center justify-center size-9 rounded-lg shadow-md transition-all",
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
              title="Stop execution"
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={() => executeWorkflow()}
              className={cn(
                "flex items-center justify-center size-9 rounded-lg shadow-md transition-all",
                "bg-emerald-500 text-white hover:bg-emerald-600"
              )}
              title="Run workflow"
            >
              <Play size={16} fill="currentColor" />
            </button>
          )}

          {/* Add node button */}
          <button
            onClick={() => openPanel('regular')}
            className="flex items-center justify-center size-9 rounded-lg bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
            title="Add node"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}
