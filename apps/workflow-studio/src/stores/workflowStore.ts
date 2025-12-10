import { create } from 'zustand';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from 'reactflow';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import type { WorkflowNodeData, NodeExecutionData, StickyNoteData } from '../types/workflow';
import { isTriggerNode } from '../hooks/useNodeTypes';

// Backend-compatible pinned data format: { json: {...} }[]
type BackendNodeData = { json: Record<string, unknown> };

// Connection validation result
interface ConnectionValidation {
  isValid: boolean;
  message?: string;
}

interface WorkflowState {
  // Workflow metadata
  workflowName: string;
  workflowTags: string[];
  isActive: boolean;
  workflowId?: string;  // Backend workflow ID (set after save)

  // Workflow data
  nodes: Node[];
  edges: Edge[];

  // Selection
  selectedNodeId: string | null;

  // Execution data per node
  executionData: Record<string, NodeExecutionData>;

  // Pinned data per node - backend format: { json: {...} }[]
  pinnedData: Record<string, BackendNodeData[]>;

  // Metadata actions
  setWorkflowName: (name: string) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  setIsActive: (active: boolean) => void;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  validateConnection: (connection: Connection) => ConnectionValidation;
  isValidConnection: (connection: Connection) => boolean;

  addNode: (node: Node) => void;
  addStickyNote: (position: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  updateStickyNote: (nodeId: string, data: Partial<StickyNoteData>) => void;
  deleteNode: (nodeId: string) => void;

  setSelectedNode: (nodeId: string | null) => void;

  // Execution
  setNodeExecutionData: (nodeId: string, data: NodeExecutionData) => void;
  clearExecutionData: () => void;

  // Pinned data - uses backend format { json: {...} }[]
  pinNodeData: (nodeId: string, data: BackendNodeData[]) => void;
  unpinNodeData: (nodeId: string) => void;
  hasPinnedData: (nodeId: string) => boolean;
  getPinnedDataForDisplay: (nodeId: string) => Record<string, unknown>[];

  // Workflow ID management
  setWorkflowId: (id: string) => void;
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
  // Workflow metadata
  workflowName: 'My workflow',
  workflowTags: [],
  isActive: false,
  workflowId: undefined,

  nodes: initialNodes,
  edges: [],
  selectedNodeId: null,
  executionData: {},
  pinnedData: {},

  // Metadata actions
  setWorkflowName: (name) => set({ workflowName: name }),
  addTag: (tag) => set({ workflowTags: [...get().workflowTags, tag] }),
  removeTag: (tag) => set({ workflowTags: get().workflowTags.filter((t) => t !== tag) }),
  setIsActive: (active) => set({ isActive: active }),

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

  // Connection validation logic
  validateConnection: (connection) => {
    const { nodes, edges } = get();
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);

    // Basic validation
    if (!sourceNode || !targetNode) {
      return { isValid: false, message: 'Invalid nodes' };
    }

    // Can't connect to self
    if (connection.source === connection.target) {
      return { isValid: false, message: 'Cannot connect node to itself' };
    }

    // Can't connect to trigger nodes (they have no inputs)
    if (isTriggerNode(targetNode.data?.type || '')) {
      return { isValid: false, message: 'Cannot connect to trigger nodes' };
    }

    // Can't connect to sticky notes
    if (targetNode.type === 'stickyNote' || sourceNode.type === 'stickyNote') {
      return { isValid: false, message: 'Cannot connect sticky notes' };
    }

    // Check for duplicate connections
    const duplicateConnection = edges.some(
      (e) =>
        e.source === connection.source &&
        e.target === connection.target &&
        e.sourceHandle === connection.sourceHandle &&
        e.targetHandle === connection.targetHandle
    );
    if (duplicateConnection) {
      return { isValid: false, message: 'Connection already exists' };
    }

    // Check for cycles (simple check - prevent direct back-connections)
    const wouldCreateCycle = edges.some(
      (e) => e.source === connection.target && e.target === connection.source
    );
    if (wouldCreateCycle) {
      return { isValid: false, message: 'Would create a cycle' };
    }

    return { isValid: true };
  },

  isValidConnection: (connection) => {
    return get().validateConnection(connection).isValid;
  },

  onConnect: (connection) => {
    const validation = get().validateConnection(connection);
    if (!validation.isValid) {
      return;
    }

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

  addStickyNote: (position) => {
    const id = `sticky-${Date.now()}`;
    const stickyNode: Node = {
      id,
      type: 'stickyNote',
      position,
      data: {
        content: '',
        color: 'yellow',
      },
    };
    set({ nodes: [...get().nodes, stickyNode] });
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

  updateStickyNote: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId && node.type === 'stickyNote'
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    });
  },

  deleteNode: (nodeId) => {
    const { nodes, edges, pinnedData } = get();

    // If deleting the last node, restore the placeholder
    const remainingNodes = nodes.filter((n) => n.id !== nodeId);
    const hasRealNodes = remainingNodes.some((n) => n.type !== 'addNodes' && n.type !== 'stickyNote');

    // Remove pinned data for deleted node
    const newPinnedData = { ...pinnedData };
    delete newPinnedData[nodeId];

    set({
      nodes: hasRealNodes
        ? remainingNodes
        : initialNodes,
      edges: edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      pinnedData: newPinnedData,
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

  // Pinned data methods - uses backend format { json: {...} }[]
  pinNodeData: (nodeId, data) => {
    set({
      pinnedData: {
        ...get().pinnedData,
        [nodeId]: data,
      },
    });

    // Also update node's pinnedData field for backend compatibility
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, pinnedData: data } }
          : node
      ),
    });
  },

  unpinNodeData: (nodeId) => {
    const newPinnedData = { ...get().pinnedData };
    delete newPinnedData[nodeId];
    set({ pinnedData: newPinnedData });

    // Also clear node's pinnedData field
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, pinnedData: undefined } }
          : node
      ),
    });
  },

  hasPinnedData: (nodeId) => {
    return nodeId in get().pinnedData;
  },

  // Get pinned data in display format (unwrapped from { json: {...} })
  getPinnedDataForDisplay: (nodeId) => {
    const pinned = get().pinnedData[nodeId];
    if (!pinned) return [];
    return pinned.map((item) => item.json);
  },

  // Workflow ID management
  setWorkflowId: (id) => set({ workflowId: id }),
}));
