import { create } from 'zustand';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from 'reactflow';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import type { WorkflowNodeData, NodeExecutionData } from '../types/workflow';

interface WorkflowState {
  // Workflow data
  nodes: Node[];
  edges: Edge[];

  // Selection
  selectedNodeId: string | null;

  // Execution data per node
  executionData: Record<string, NodeExecutionData>;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  deleteNode: (nodeId: string) => void;

  setSelectedNode: (nodeId: string | null) => void;

  // Execution
  setNodeExecutionData: (nodeId: string, data: NodeExecutionData) => void;
  clearExecutionData: () => void;
}

// Initial "Add first step" node for empty canvas
const initialNodes: Node[] = [
  {
    id: 'add-nodes-placeholder',
    type: 'addNodes',
    position: { x: 250, y: 200 },
    data: { label: 'Add first step...' },
  },
];

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: initialNodes,
  edges: [],
  selectedNodeId: null,
  executionData: {},

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(
        { ...connection, type: 'workflowEdge' },
        get().edges
      ),
    });
  },

  addNode: (node) => {
    const { nodes } = get();

    // Remove the placeholder "add nodes" button if this is the first real node
    const hasOnlyPlaceholder = nodes.length === 1 && nodes[0].type === 'addNodes';

    set({
      nodes: hasOnlyPlaceholder
        ? [node]
        : [...nodes, node],
    });
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    });
  },

  deleteNode: (nodeId) => {
    const { nodes, edges } = get();

    // If deleting the last node, restore the placeholder
    const remainingNodes = nodes.filter((n) => n.id !== nodeId);
    const hasRealNodes = remainingNodes.some((n) => n.type !== 'addNodes');

    set({
      nodes: hasRealNodes
        ? remainingNodes
        : initialNodes,
      edges: edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
    });
  },

  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),

  setNodeExecutionData: (nodeId, data) => {
    set({
      executionData: {
        ...get().executionData,
        [nodeId]: data,
      },
    });
  },

  clearExecutionData: () => set({ executionData: {} }),
}));
