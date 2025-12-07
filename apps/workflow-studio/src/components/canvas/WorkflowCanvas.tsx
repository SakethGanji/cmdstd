import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type OnConnect,
  Panel,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useWorkflowStore } from '../../stores/workflowStore';
import { useNodeCreatorStore } from '../../stores/nodeCreatorStore';
import AddNodesButton from './nodes/AddNodesButton';
import WorkflowNode from './nodes/WorkflowNode';
import WorkflowEdge from './edges/WorkflowEdge';

// Define custom node types - use 'any' to work around React 19 type incompatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: any = {
  addNodes: AddNodesButton,
  workflowNode: WorkflowNode,
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
  } = useWorkflowStore();

  const openPanel = useNodeCreatorStore((s) => s.openPanel);

  const handleConnect: OnConnect = useCallback(
    (connection) => {
      onConnect(connection);
    },
    [onConnect]
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

        {/* MiniMap moved to left */}
        <MiniMap
          position="bottom-left"
          nodeColor={(node) => {
            if (node.type === 'addNodes') return 'var(--muted)';
            return 'var(--primary)';
          }}
          maskColor="hsl(var(--background) / 0.8)"
          className="!bg-card !shadow-md !rounded-lg !border !border-border"
        />

        {/* Status Panel significantly enhanced for "more things going on" */}
        <Panel position="bottom-right" className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card/80 backdrop-blur-sm border border-border/50 text-xs font-medium text-muted-foreground shadow-sm">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              System Up
            </div>
            <div className="w-px h-3 bg-border"></div>
            <div>
              {nodes.length} Node{nodes.length !== 1 && 's'}
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
