import { useCallback, useMemo, useEffect, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import ReactFlow, {
  Background,
  MiniMap,
  type OnConnect,
  type OnConnectStart,
  type Connection,
  type Node,
  BackgroundVariant,
  useReactFlow,
  ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useWorkflowStore } from '../../stores/workflowStore';
import { useNodeCreatorStore } from '../../stores/nodeCreatorStore';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useSaveWorkflow } from '../../hooks/useWorkflowApi';
import { getNodeIcon } from '../../hooks/useNodeTypes';
import AddNodesButton from './nodes/AddNodesButton';
import WorkflowNode from './nodes/WorkflowNode';
import SubnodeNode from './nodes/SubnodeNode';
import WorkflowEdge from './edges/WorkflowEdge';
import SubnodeEdge from './edges/SubnodeEdge';
import StickyNote from './nodes/StickyNote';
import NodeContextMenu from './NodeContextMenu';
import { KeyboardShortcutsHelp } from '../KeyboardShortcutsHelp';
import { getNodeGroupFromType, getMiniMapColor, calculateNodeDimensions, type NodeGroup } from '../../lib/nodeStyles';
import { generateNodeName, getExistingNodeNames } from '../../lib/workflowTransform';
import { isTriggerType } from '../../lib/nodeConfig';
import type { WorkflowNodeData, SubnodeSlotDefinition, OutputStrategy } from '../../types/workflow';
import type { NodeIO } from '../../lib/nodeStyles';

// Define custom node types - use 'any' to work around React 19 type incompatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: any = {
  addNodes: AddNodesButton,
  workflowNode: WorkflowNode,
  subnodeNode: SubnodeNode,
  stickyNote: StickyNote,
};

// Define custom edge types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes: any = {
  workflowEdge: WorkflowEdge,
  subnodeEdge: SubnodeEdge,
};

// Distance threshold for detecting drop near a node (in pixels)
const DROP_PROXIMITY_THRESHOLD = 100;

// Property definition from API (matching NodeCreatorPanel)
interface ApiProperty {
  name: string;
  displayName: string;
  type: string;
  default?: unknown;
  [key: string]: unknown;
}

// Extended node definition for drag data
interface DraggedNodeData {
  type: string;
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  category?: string;
  group?: NodeGroup;
  inputCount?: number;
  outputCount?: number;
  inputs?: NodeIO[];
  outputs?: NodeIO[];
  subnodeSlots?: SubnodeSlotDefinition[];
  outputStrategy?: OutputStrategy;
  properties?: ApiProperty[];
}

export default function WorkflowCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setSelectedNode,
    isValidConnection,
    isInputConnected,
    setDraggedNodeType,
    clearDropTarget,
  } = useWorkflowStore();

  const closePanel = useNodeCreatorStore((s) => s.closePanel);
  const openForConnection = useNodeCreatorStore((s) => s.openForConnection);
  const { fitView, screenToFlowPosition, getNodes } = useReactFlow();

  // Track the current connection being dragged
  const connectingRef = useRef<{ nodeId: string; handleId: string | null } | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);

  const { saveWorkflow } = useSaveWorkflow();

  // Initialize keyboard shortcuts
  const { shortcuts, isShortcutsHelpOpen, setIsShortcutsHelpOpen } = useKeyboardShortcuts({
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

  // Track when a connection drag starts
  const handleConnectStart: OnConnectStart = useCallback(
    (_, { nodeId, handleId }) => {
      connectingRef.current = { nodeId: nodeId || '', handleId };
    },
    []
  );

  // Handle when a connection drag ends (either connected or dropped in empty space)
  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const connecting = connectingRef.current;
      connectingRef.current = null;

      if (!connecting) return;

      // Check if we dropped on a valid target (ReactFlow handles this)
      // We need to check if the drop was on the pane (empty space)
      const target = event.target as HTMLElement;
      const isPane = target.classList.contains('react-flow__pane');

      if (isPane) {
        // Dropped in empty space - open node creator at this position
        const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
        const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;

        const dropPosition = screenToFlowPosition({
          x: clientX,
          y: clientY,
        });

        // Open node creator with connection context and drop position
        openForConnection(connecting.nodeId, connecting.handleId || 'output-0', dropPosition);
      }
    },
    [screenToFlowPosition, openForConnection]
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
    setContextMenu(null);
  }, [setSelectedNode]);

  // Handle right-click on nodes
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      // Don't show context menu for placeholder or sticky notes
      if (node.type === 'addNodes' || node.type === 'stickyNote') return;

      setContextMenu({
        nodeId: node.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );

  // Find the nearest node to a drop position that can accept an input connection
  const findNearestConnectableNode = useCallback(
    (dropPosition: { x: number; y: number }) => {
      const flowNodes = getNodes();
      let nearestNode = null;
      let nearestDistance = DROP_PROXIMITY_THRESHOLD;

      for (const node of flowNodes) {
        // Skip placeholder, sticky notes, and subnodes
        if (node.type !== 'workflowNode') continue;

        // Skip trigger nodes (they have no inputs)
        if (isTriggerType(node.data?.type || '')) continue;

        // Skip nodes that already have an input connection
        if (isInputConnected(node.id)) continue;

        // Calculate node dimensions
        const nodeData = node.data as WorkflowNodeData;
        const inputCount = Math.max(1, nodeData.inputCount ?? nodeData.inputs?.length ?? 1);
        const outputCount = Math.max(1, nodeData.outputCount ?? nodeData.outputs?.length ?? 1);
        const subnodeSlotCount = nodeData.subnodeSlots?.length ?? 0;
        const dimensions = calculateNodeDimensions(inputCount, outputCount, subnodeSlotCount);

        // Calculate distance to the left edge of the node (where inputs are)
        const nodeLeftX = node.position.x;
        const nodeCenterY = node.position.y + dimensions.height / 2;

        const distance = Math.sqrt(
          Math.pow(dropPosition.x - nodeLeftX, 2) +
          Math.pow(dropPosition.y - nodeCenterY, 2)
        );

        // Only consider if drop is to the left of the node (input side)
        if (dropPosition.x < nodeLeftX + 20 && distance < nearestDistance) {
          nearestDistance = distance;
          nearestNode = node;
        }
      }

      return nearestNode;
    },
    [getNodes, isInputConnected]
  );

  // Find the nearest edge to a drop position (for inserting between nodes)
  const findNearestEdge = useCallback(
    (dropPosition: { x: number; y: number }) => {
      let nearestEdge = null;
      let nearestDistance = DROP_PROXIMITY_THRESHOLD;

      for (const edge of edges) {
        // Skip subnode edges
        if (edge.data?.isSubnodeEdge) continue;

        // Get source and target nodes
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);

        if (!sourceNode || !targetNode) continue;

        // Calculate midpoint of the edge (approximation)
        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2;

        const distance = Math.sqrt(
          Math.pow(dropPosition.x - midX, 2) +
          Math.pow(dropPosition.y - midY, 2)
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestEdge = edge;
        }
      }

      return nearestEdge;
    },
    [edges, nodes]
  );

  // Handle drag over canvas
  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop on canvas
  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const nodeDataStr = event.dataTransfer.getData('application/reactflow-node');
      if (!nodeDataStr) return;

      let draggedNode: DraggedNodeData;
      try {
        draggedNode = JSON.parse(nodeDataStr);
      } catch {
        return;
      }

      // Convert screen coordinates to flow coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Check if dropping near an unconnected node input
      const nearNode = findNearestConnectableNode(position);

      // Check if dropping on an edge
      const nearEdge = findNearestEdge(position);

      // Create the new node
      const newNodeId = `node-${Date.now()}`;
      const existingNames = getExistingNodeNames(nodes as Node<WorkflowNodeData>[]);
      const nodeName = generateNodeName(draggedNode.name, existingNames);

      // Extract defaults from properties
      const defaultParams: Record<string, unknown> = {};
      if (draggedNode.properties) {
        for (const prop of draggedNode.properties) {
          if (prop.default !== undefined) {
            defaultParams[prop.name] = prop.default;
          }
        }
      }

      const isTrigger = isTriggerType(draggedNode.type);
      const inputCount = isTrigger ? 0 : Math.max(1, draggedNode.inputCount ?? draggedNode.inputs?.length ?? 1);
      const outputCount = Math.max(1, draggedNode.outputCount ?? draggedNode.outputs?.length ?? 1);

      const nodeData: WorkflowNodeData = {
        name: nodeName,
        label: draggedNode.displayName,
        type: draggedNode.type,
        icon: getNodeIcon(draggedNode.type, draggedNode.icon),
        description: draggedNode.description,
        parameters: defaultParams,
        continueOnFail: false,
        retryOnFail: 0,
        retryDelay: 1000,
        group: draggedNode.group,
        inputCount,
        outputCount,
        inputs: draggedNode.inputs,
        outputs: draggedNode.outputs,
        outputStrategy: draggedNode.outputStrategy,
        subnodeSlots: draggedNode.subnodeSlots,
      };

      // Calculate final position
      let finalPosition = position;

      // If dropping on an edge, position between the two nodes
      if (nearEdge && !nearNode) {
        const sourceNode = nodes.find((n) => n.id === nearEdge.source);
        const targetNode = nodes.find((n) => n.id === nearEdge.target);

        if (sourceNode && targetNode) {
          finalPosition = {
            x: (sourceNode.position.x + targetNode.position.x) / 2,
            y: (sourceNode.position.y + targetNode.position.y) / 2,
          };
        }
      }
      // If dropping near a node input, position to the left of that node
      else if (nearNode) {
        finalPosition = {
          x: nearNode.position.x - 200,
          y: nearNode.position.y,
        };
      }

      // Snap to grid
      finalPosition = {
        x: Math.round(finalPosition.x / 20) * 20,
        y: Math.round(finalPosition.y / 20) * 20,
      };

      const newNode = {
        id: newNodeId,
        type: 'workflowNode',
        position: finalPosition,
        data: nodeData,
      };

      addNode(newNode);

      // Auto-connect based on drop target
      if (nearEdge && !nearNode) {
        // Dropping on edge: delete old edge and create two new connections
        // Remove the old edge
        const newEdges = edges.filter((e) => e.id !== nearEdge.id);
        useWorkflowStore.getState().setEdges(newEdges);

        // Connect source -> new node
        if (!isTrigger) {
          onConnect({
            source: nearEdge.source,
            target: newNodeId,
            sourceHandle: nearEdge.sourceHandle ?? null,
            targetHandle: null,
          });
        }

        // Connect new node -> target
        onConnect({
          source: newNodeId,
          target: nearEdge.target,
          sourceHandle: draggedNode.outputs?.[0]?.name || 'output-0',
          targetHandle: nearEdge.targetHandle ?? null,
        });
      } else if (nearNode && !isTrigger) {
        // Dropping near a node input: connect new node to that input
        onConnect({
          source: newNodeId,
          target: nearNode.id,
          sourceHandle: draggedNode.outputs?.[0]?.name || 'output-0',
          targetHandle: null,
        });
      }

      // Clear drag state and close panel
      setDraggedNodeType(null);
      clearDropTarget();
      closePanel();
    },
    [
      screenToFlowPosition,
      findNearestConnectableNode,
      findNearestEdge,
      nodes,
      edges,
      addNode,
      onConnect,
      setDraggedNodeType,
      clearDropTarget,
      closePanel,
    ]
  );

  // Check if canvas is empty (only has placeholder)
  const isEmpty = useMemo(
    () => nodes.length === 1 && nodes[0].type === 'addNodes',
    [nodes]
  );

  return (
    <div className="h-full w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onSelectionChange={handleSelectionChange}
        onPaneClick={handlePaneClick}
        onNodeContextMenu={handleNodeContextMenu}
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
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={{
          stroke: '#9ca3af',
          strokeWidth: 1.5,
          strokeDasharray: '6 4',
        }}
        panOnScroll={false}
        zoomOnScroll
        panOnDrag
        selectionOnDrag
        selectionKeyCode="Control"
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

        {/* MiniMap - colored by node group, positioned to avoid sidebar */}
        <MiniMap
          position="bottom-left"
          style={{ marginBottom: 20, marginLeft: 100 }}
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


      {/* Keyboard shortcuts help modal */}
      <KeyboardShortcutsHelp
        open={isShortcutsHelpOpen}
        onOpenChange={setIsShortcutsHelpOpen}
        shortcuts={shortcuts}
      />

      {/* Node context menu */}
      {contextMenu && (
        <NodeContextMenu
          nodeId={contextMenu.nodeId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
