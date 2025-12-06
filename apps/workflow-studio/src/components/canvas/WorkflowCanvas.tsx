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
        panOnScroll
        zoomOnScroll
        panOnDrag={[1, 2]}
        selectionOnDrag={false}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        className="bg-neutral-50"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#d4d4d4"
        />
        <Controls
          showInteractive={false}
          className="!bg-white !shadow-md !rounded-lg !border !border-neutral-200"
        />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'addNodes') return '#e5e5e5';
            return '#3b82f6';
          }}
          maskColor="rgba(255, 255, 255, 0.8)"
          className="!bg-white !shadow-md !rounded-lg !border !border-neutral-200"
        />

        {/* Top toolbar */}
        <Panel position="top-center" className="flex gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-md">
            <span className="text-sm font-medium text-neutral-700">
              Untitled Workflow
            </span>
          </div>
        </Panel>

        {/* Right panel button when canvas is not empty */}
        {!isEmpty && (
          <Panel position="top-right" className="flex gap-2">
            <button
              onClick={() => openPanel('regular')}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-blue-600"
            >
              + Add Node
            </button>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
