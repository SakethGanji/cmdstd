import { create } from 'zustand';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from 'reactflow';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import type { WorkflowNodeData, NodeExecutionData, StickyNoteData, SubnodeEdgeData, SubnodeType, OutputStrategy } from '../types/workflow';
import type { NodeIO } from '../lib/nodeStyles';
import { isTriggerNode } from '../hooks/useNodeTypes';

// Subnode slot names that identify subnode connections
const SUBNODE_SLOT_NAMES = ['chatModel', 'memory', 'tools'];

// Helper to compute dynamic outputs for nodes with outputStrategy
function computeDynamicOutputs(data: WorkflowNodeData): WorkflowNodeData {
  if (!data.outputStrategy || !data.parameters) return data;

  const strategy = data.outputStrategy as OutputStrategy;
  const params = data.parameters as Record<string, unknown>;

  if (strategy.type === 'dynamicFromParameter') {
    const paramName = strategy.parameter;
    const numOutputs = paramName ? (params[paramName] as number) || 2 : 2;
    const outputCount = numOutputs + (strategy.addFallback ? 1 : 0);

    const outputs: NodeIO[] = [];
    for (let i = 0; i < numOutputs; i++) {
      outputs.push({ name: `output${i}`, displayName: `Output ${i}` });
    }
    if (strategy.addFallback) {
      outputs.push({ name: 'fallback', displayName: 'Fallback' });
    }

    return { ...data, outputCount, outputs };
  } else if (strategy.type === 'dynamicFromCollection') {
    const collectionName = strategy.collectionName;
    const collection = collectionName ? (params[collectionName] as unknown[]) || [] : [];

    const numOutputs = collection.length + (strategy.addFallback ? 1 : 0);
    const outputCount = Math.max(1, numOutputs);

    const outputs: NodeIO[] = Array.from({ length: outputCount }, (_, i) => ({
      name: i === outputCount - 1 && strategy.addFallback ? 'fallback' : `output${i}`,
      displayName: i === outputCount - 1 && strategy.addFallback ? 'Fallback' : `Output ${i}`,
    }));

    return { ...data, outputCount, outputs };
  }

  return data;
}

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
  addSubnode: (parentId: string, slotName: string, subnodeData: {
    type: string;
    label: string;
    icon?: string;
    subnodeType: SubnodeType;
    properties?: Record<string, unknown>;
  }) => void;
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

  // Load workflow from API data
  loadWorkflow: (data: {
    nodes: Node[];
    edges: Edge[];
    workflowName: string;
    workflowId: string;
    isActive: boolean;
  }) => void;

  // Reset to empty state
  resetWorkflow: () => void;
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
    const { nodes, edges } = get();

    // Check for position changes on parent nodes with subnodes
    const positionChanges = changes.filter(
      (c): c is NodeChange & { type: 'position'; position: { x: number; y: number }; id: string } =>
        c.type === 'position' && 'position' in c && c.position !== undefined
    );

    // Calculate subnode movements based on parent movements
    const subnodeUpdates: Map<string, { x: number; y: number }> = new Map();

    for (const change of positionChanges) {
      const parentNode = nodes.find((n) => n.id === change.id);
      if (!parentNode || !parentNode.data?.subnodeSlots) continue;

      // Find all subnodes connected to this parent
      const subnodeEdges = edges.filter(
        (e) => e.target === parentNode.id && e.data?.isSubnodeEdge
      );

      if (subnodeEdges.length === 0) continue;

      // Calculate delta from old position to new position
      const deltaX = change.position.x - parentNode.position.x;
      const deltaY = change.position.y - parentNode.position.y;

      // Move each connected subnode by the same delta
      for (const edge of subnodeEdges) {
        const subnodeNode = nodes.find((n) => n.id === edge.source);
        if (subnodeNode) {
          subnodeUpdates.set(subnodeNode.id, {
            x: subnodeNode.position.x + deltaX,
            y: subnodeNode.position.y + deltaY,
          });
        }
      }
    }

    // Apply the changes
    let updatedNodes = applyNodeChanges(changes, nodes);

    // Apply subnode position updates
    if (subnodeUpdates.size > 0) {
      updatedNodes = updatedNodes.map((node) => {
        const update = subnodeUpdates.get(node.id);
        if (update) {
          return {
            ...node,
            position: update,
          };
        }
        return node;
      });
    }

    set({ nodes: updatedNodes });
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

    // Can't connect to sticky notes
    if (targetNode.type === 'stickyNote' || sourceNode.type === 'stickyNote') {
      return { isValid: false, message: 'Cannot connect sticky notes' };
    }

    // Check if this is a subnode connection (subnode -> parent slot)
    const isSubnodeConnection =
      sourceNode.type === 'subnodeNode' &&
      SUBNODE_SLOT_NAMES.includes(connection.targetHandle || '');

    if (isSubnodeConnection) {
      // Validate subnode slot compatibility
      const targetSlots = targetNode.data?.subnodeSlots || [];
      const slot = targetSlots.find((s: { name: string }) => s.name === connection.targetHandle);

      if (!slot) {
        return { isValid: false, message: 'Invalid subnode slot' };
      }

      // Check slot type matches subnode type
      if (slot.slotType !== sourceNode.data?.subnodeType) {
        return {
          isValid: false,
          message: `Slot expects ${slot.slotType}, got ${sourceNode.data?.subnodeType}`
        };
      }

      // Check if slot already has connection (unless multiple allowed)
      if (!slot.multiple) {
        const existingConnection = edges.find(
          (e) => e.target === connection.target && e.targetHandle === connection.targetHandle
        );
        if (existingConnection) {
          return { isValid: false, message: 'Slot already connected' };
        }
      }

      // Check for duplicate subnode connections
      const duplicateConnection = edges.some(
        (e) =>
          e.source === connection.source &&
          e.target === connection.target &&
          e.targetHandle === connection.targetHandle
      );
      if (duplicateConnection) {
        return { isValid: false, message: 'Connection already exists' };
      }

      return { isValid: true };
    }

    // Normal connection validation
    // Can't connect to trigger nodes (they have no inputs)
    if (isTriggerNode(targetNode.data?.type || '')) {
      return { isValid: false, message: 'Cannot connect to trigger nodes' };
    }

    // Subnodes can only connect to parent slots, not normal inputs
    if (sourceNode.type === 'subnodeNode') {
      return { isValid: false, message: 'Subnodes can only connect to parent node slots' };
    }

    // Can't connect normal nodes to subnode slots
    if (SUBNODE_SLOT_NAMES.includes(connection.targetHandle || '')) {
      return { isValid: false, message: 'Only subnodes can connect to this slot' };
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

    const { nodes } = get();
    const sourceNode = nodes.find((n) => n.id === connection.source);

    // Check if this is a subnode connection
    const isSubnodeConnection =
      sourceNode?.type === 'subnodeNode' &&
      SUBNODE_SLOT_NAMES.includes(connection.targetHandle || '');

    if (isSubnodeConnection) {
      // Create subnode edge with proper data
      const subnodeEdgeData: SubnodeEdgeData = {
        isSubnodeEdge: true,
        slotName: connection.targetHandle || '',
        slotType: sourceNode?.data?.subnodeType || 'tool',
      };

      set({
        edges: addEdge(
          {
            ...connection,
            type: 'subnodeEdge',
            data: subnodeEdgeData,
          },
          get().edges
        ),
      });
    } else {
      // Normal workflow edge
      set({
        edges: addEdge(
          { ...connection, type: 'workflowEdge' },
          get().edges
        ),
      });
    }
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

  addSubnode: (parentId, slotName, subnodeData) => {
    const { nodes, edges } = get();
    const parentNode = nodes.find((n) => n.id === parentId);
    if (!parentNode) return;

    // Get slots from parent
    const slots = parentNode.data?.subnodeSlots || [];
    const slotIndex = slots.findIndex((s: { name: string }) => s.name === slotName);
    if (slotIndex === -1) return;

    // Calculate parent node width (nodes with slots are ~180px wide)
    const parentWidth = slots.length > 0 ? Math.max(180, slots.length * 55 + 20) : 64;

    // Calculate subnode position below the parent slot
    // Each slot takes up equal space across the parent width
    const slotCenterPercent = (slotIndex + 0.5) / slots.length;
    const slotCenterX = parentNode.position.x + (parentWidth * slotCenterPercent);
    const subnodeX = slotCenterX - 24; // Subtract half subnode width (48px / 2)
    const subnodeY = parentNode.position.y + 130; // Below parent node

    // Create subnode
    const newNode: Node = {
      id: `${subnodeData.type}-${Date.now()}`,
      type: 'subnodeNode',
      position: { x: subnodeX, y: subnodeY },
      data: {
        name: subnodeData.type,
        type: subnodeData.type,
        label: subnodeData.label,
        icon: subnodeData.icon || 'wrench',
        isSubnode: true,
        subnodeType: subnodeData.subnodeType,
        nodeShape: 'circular',
        parameters: subnodeData.properties || {},
      },
    };

    // Create edge connecting subnode to parent slot
    const subnodeEdgeData: SubnodeEdgeData = {
      isSubnodeEdge: true,
      slotName,
      slotType: subnodeData.subnodeType,
    };

    const newEdge: Edge = {
      id: `${newNode.id}-${parentId}-config-${slotName}`,
      source: newNode.id,
      target: parentId,
      sourceHandle: 'config',
      targetHandle: slotName,
      type: 'subnodeEdge',
      data: subnodeEdgeData,
    };

    set({
      nodes: [...nodes, newNode],
      edges: [...edges, newEdge],
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
      nodes: get().nodes.map((node) => {
        if (node.id !== nodeId) return node;

        const currentData = node.data as WorkflowNodeData;
        let updatedData = { ...currentData, ...data };

        // If parameters changed and node has outputStrategy, recalculate outputs
        if (data.parameters && updatedData.outputStrategy) {
          updatedData = computeDynamicOutputs(updatedData);
        }

        return { ...node, data: updatedData };
      }),
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

  // Load workflow from API data
  loadWorkflow: (data) => {
    // Process nodes to compute dynamic outputs for nodes with outputStrategy
    const processedNodes = data.nodes.map((node) => {
      if (node.type === 'workflow' && node.data) {
        const nodeData = node.data as WorkflowNodeData;
        if (nodeData.outputStrategy) {
          return { ...node, data: computeDynamicOutputs(nodeData) };
        }
      }
      return node;
    });

    set({
      nodes: processedNodes,
      edges: data.edges,
      workflowName: data.workflowName,
      workflowId: data.workflowId,
      isActive: data.isActive,
      selectedNodeId: null,
      executionData: {},
      pinnedData: {},
    });
  },

  // Reset to empty state
  resetWorkflow: () =>
    set({
      nodes: initialNodes,
      edges: [],
      workflowName: 'My workflow',
      workflowId: undefined,
      isActive: false,
      selectedNodeId: null,
      executionData: {},
      pinnedData: {},
      workflowTags: [],
    }),
}));
