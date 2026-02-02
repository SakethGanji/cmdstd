/**
 * Workflow Transformation Utilities
 *
 * Transforms between ReactFlow format (UI) and Backend API format.
 * The key differences:
 * - UI uses node.id (React Flow generated), backend uses node.name
 * - UI uses edge.source/target, backend uses connection.sourceNode/targetNode
 *
 * Node types use backend PascalCase names everywhere (Start, Set, HttpRequest, etc.)
 */

import type { Node, Edge } from 'reactflow';
import type { WorkflowNodeData } from '../types/workflow';
import { getNodeIcon, normalizeNodeGroup, isTriggerType } from './nodeConfig';

// Backend types (internal)
interface BackendNodeData {
  json: Record<string, unknown>;
  binary?: Record<string, unknown>;
}

interface BackendNodeDefinition {
  name: string;
  type: string;
  label?: string;
  parameters: Record<string, unknown>;
  position?: { x: number; y: number };
  continueOnFail?: boolean;
  retryOnFail?: number;
  retryDelay?: number;
  pinnedData?: BackendNodeData[];
}

interface BackendConnection {
  source_node: string;
  source_output: string;
  target_node: string;
  target_input: string;
  connection_type?: 'normal' | 'subnode';
  slot_name?: string;
  waypoints?: Array<{ x: number; y: number }>;  // Manual edge routing
}

export interface BackendWorkflow {
  id?: string;
  name: string;
  nodes: BackendNodeDefinition[];
  connections: BackendConnection[];
}

// ============================================================================
// Default Parameters (for node creation)
// ============================================================================

/**
 * Returns default parameters for a node type.
 *
 * NOTE: Most defaults are now defined in the backend node schemas and applied
 * by DynamicNodeForm when rendering. Only add frontend defaults here for
 * parameters that need immediate values at node creation time.
 */
export function getDefaultParameters(_backendType: string): Record<string, unknown> {
  // All defaults are now managed by the backend schema.
  // The DynamicNodeForm uses property.default from the API response.
  return {};
}

// ============================================================================
// Name Generation
// ============================================================================

/**
 * Generates a unique node name based on the type and existing nodes.
 * Backend requires unique names, so we append a number if needed.
 *
 * @example
 * generateNodeName('HttpRequest', []) => 'HttpRequest'
 * generateNodeName('HttpRequest', ['HttpRequest']) => 'HttpRequest1'
 * generateNodeName('HttpRequest', ['HttpRequest', 'HttpRequest1']) => 'HttpRequest2'
 */
export function generateNodeName(
  backendType: string,
  existingNames: string[]
): string {
  const baseName = backendType;

  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  let counter = 1;
  while (existingNames.includes(`${baseName}${counter}`)) {
    counter++;
  }

  return `${baseName}${counter}`;
}

// ============================================================================
// ReactFlow → Backend Transformation
// ============================================================================

/**
 * Transforms ReactFlow nodes and edges to backend workflow format.
 *
 * @param nodes - ReactFlow nodes (includes workflowNode, addNodes, stickyNote)
 * @param edges - ReactFlow edges
 * @param workflowName - Name of the workflow
 * @param workflowId - Optional workflow ID (for updates)
 */
export function toBackendWorkflow(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  workflowName: string,
  workflowId?: string
): BackendWorkflow {
  // Filter to workflow nodes AND subnode nodes (exclude addNodes placeholder and sticky notes)
  const workflowNodes = nodes.filter(
    (n) => n.type === 'workflowNode' || n.type === 'subworkflowNode'
  ) as Node<WorkflowNodeData>[];

  const subnodeNodes = nodes.filter(
    (n) => n.type === 'subnodeNode'
  ) as Node<WorkflowNodeData>[];

  // Build a map from React Flow node ID to node name (for connection mapping)
  const idToName = new Map<string, string>();
  workflowNodes.forEach((node) => {
    idToName.set(node.id, node.data.name);
  });
  subnodeNodes.forEach((node) => {
    idToName.set(node.id, node.data.name);
  });

  // Track which nodes are subnodes for connection type
  const subnodeIds = new Set(subnodeNodes.map((n) => n.id));

  // Transform workflow nodes - type is already backend format
  const backendNodes: BackendNodeDefinition[] = workflowNodes.map((node) => ({
    name: node.data.name,
    type: node.data.type,
    label: node.data.label,
    parameters: node.data.parameters || {},
    position: {
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
    },
    continueOnFail: node.data.continueOnFail || false,
    retryOnFail: node.data.retryOnFail || 0,
    retryDelay: node.data.retryDelay || 1000,
    pinnedData: node.data.pinnedData,
  }));

  // Transform subnode nodes - type is already backend format
  const backendSubnodes: BackendNodeDefinition[] = subnodeNodes.map((node) => ({
    name: node.data.name,
    type: node.data.type,
    parameters: node.data.parameters || {},
    position: {
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
    },
    continueOnFail: false,
    retryOnFail: 0,
    retryDelay: 1000,
  }));

  // Transform edges to connections (deduplicate by source+target+handles)
  const seenConnections = new Set<string>();
  const connections: BackendConnection[] = edges
    .filter((edge) => {
      // Include edges where both source and target are valid nodes
      const sourceName = idToName.get(edge.source);
      const targetName = idToName.get(edge.target);
      if (!sourceName || !targetName) return false;
      // Deduplicate connections with same source/target/handles
      const key = `${sourceName}::${edge.sourceHandle || ''}::${targetName}::${edge.targetHandle || ''}`;
      if (seenConnections.has(key)) return false;
      seenConnections.add(key);
      return true;
    })
    .map((edge) => {
      const isSubnodeConnection = subnodeIds.has(edge.source);
      const edgeData = edge.data as { slotName?: string; waypoints?: Array<{ x: number; y: number }> } | undefined;
      const waypoints = edgeData?.waypoints;

      if (isSubnodeConnection) {
        // Subnode connection - source is a subnode, target is a parent node
        const slotName = edgeData?.slotName || edge.targetHandle || undefined;
        return {
          source_node: idToName.get(edge.source)!,
          source_output: edge.sourceHandle || 'config',
          target_node: idToName.get(edge.target)!,
          target_input: slotName || 'main',
          connection_type: 'subnode' as const,
          slot_name: slotName,
          ...(waypoints && waypoints.length > 0 ? { waypoints } : {}),
        };
      } else {
        // Normal connection between workflow nodes
        return {
          source_node: idToName.get(edge.source)!,
          source_output: edge.sourceHandle || 'main',
          target_node: idToName.get(edge.target)!,
          target_input: edge.targetHandle || 'main',
          ...(waypoints && waypoints.length > 0 ? { waypoints } : {}),
        };
      }
    });

  return {
    id: workflowId,
    name: workflowName,
    nodes: [...backendNodes, ...backendSubnodes],
    connections,
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Gets all existing node names from the nodes array
 */
export function getExistingNodeNames(nodes: Node<WorkflowNodeData>[]): string[] {
  return nodes
    .filter((n) => n.type === 'workflowNode' || n.type === 'subworkflowNode')
    .map((n) => n.data.name);
}

// ============================================================================
// Backend → ReactFlow Transformation
// ============================================================================

/**
 * API response types (snake_case from backend)
 */
interface ApiWorkflowDetail {
  id: string;
  name: string;
  active: boolean;
  definition: {
    nodes: Array<{
      name: string;
      type: string;
      label?: string;
      parameters: Record<string, unknown>;
      position?: { x: number; y: number };
      // Enriched I/O data from backend
      inputs?: Array<{ name: string; displayName: string }>;
      inputCount?: number;
      outputs?: Array<{ name: string; displayName: string }>;
      outputCount?: number;
      inputStrategy?: Record<string, unknown>;
      outputStrategy?: Record<string, unknown>;
      // Node group for styling
      group?: string[];
      // Subnode properties
      isSubnode?: boolean;
      subnodeType?: 'model' | 'memory' | 'tool';
      subnodeSlots?: Array<{
        name: string;
        displayName: string;
        slotType: 'model' | 'memory' | 'tool';
        required: boolean;
        multiple: boolean;
      }>;
    }>;
    connections: Array<{
      source_node: string;
      target_node: string;
      source_output: string;
      target_input: string;
      connection_type?: 'normal' | 'subnode';
      slot_name?: string;
      waypoints?: Array<{ x: number; y: number }>;
    }>;
  };
}

// Known subnode type prefixes/patterns for detection
const SUBNODE_TYPE_PATTERNS: Array<{ pattern: RegExp; subnodeType: 'model' | 'memory' | 'tool' }> = [
  { pattern: /Model$/i, subnodeType: 'model' },
  { pattern: /^(Gemini|OpenAI|Anthropic|Claude)/i, subnodeType: 'model' },
  { pattern: /Memory$/i, subnodeType: 'memory' },
  { pattern: /^(Simple|Buffer|Window|SQLite)Memory/i, subnodeType: 'memory' },
  { pattern: /Tool$/i, subnodeType: 'tool' },
  { pattern: /^(Calculator|CurrentTime|RandomNumber|Text)$/i, subnodeType: 'tool' },
];

/**
 * Detects if a node type is a subnode and returns its subnode type
 */
function detectSubnodeType(nodeType: string, isSubnode?: boolean): 'model' | 'memory' | 'tool' | null {
  // If explicitly marked as subnode in backend response
  if (isSubnode) {
    for (const { pattern, subnodeType } of SUBNODE_TYPE_PATTERNS) {
      if (pattern.test(nodeType)) {
        return subnodeType;
      }
    }
    return 'tool'; // Default subnode type
  }

  // Try to detect from type name
  for (const { pattern, subnodeType } of SUBNODE_TYPE_PATTERNS) {
    if (pattern.test(nodeType)) {
      return subnodeType;
    }
  }

  return null;
}

/**
 * Transforms backend workflow to ReactFlow nodes and edges.
 */
export function fromBackendWorkflow(api: ApiWorkflowDetail): {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  workflowName: string;
  workflowId: string;
  isActive: boolean;
} {
  // First pass: identify subnodes from connections (subnode connections have connection_type: 'subnode')
  const subnodeNames = new Set<string>();
  for (const conn of api.definition.connections) {
    if (conn.connection_type === 'subnode') {
      subnodeNames.add(conn.source_node);
    }
  }

  // Build name to ID map (we use the name as the ID for simplicity)
  // Node types use backend PascalCase format directly
  const nodes: Node<WorkflowNodeData>[] = api.definition.nodes.map((node) => {
    // Determine if this is a subnode
    const isSubnodeFromConnection = subnodeNames.has(node.name);
    const subnodeType = detectSubnodeType(node.type, node.isSubnode || isSubnodeFromConnection);
    const isSubnode = subnodeType !== null;

    if (isSubnode) {
      // Create subnode node
      return {
        id: node.name,
        type: 'subnodeNode',
        position: node.position || { x: 0, y: 0 },
        data: {
          name: node.name,
          type: node.type,
          label: node.label || node.name,
          icon: getNodeIcon(node.type),
          parameters: node.parameters,
          isSubnode: true,
          subnodeType: node.subnodeType || subnodeType,
          nodeShape: 'circular',
        } as WorkflowNodeData,
      };
    }

    // Check if this is an ExecuteWorkflow node with a workflowId → render as subworkflowNode
    if (node.type === 'ExecuteWorkflow' && node.parameters?.workflowId) {
      const isTrigger = false; // ExecuteWorkflow is never a trigger
      const defaultInputs = [{ name: 'main', displayName: 'Main' }];
      const defaultOutputs = [{ name: 'main', displayName: 'Main' }];

      return {
        id: node.name,
        type: 'subworkflowNode',
        position: node.position || { x: 0, y: 0 },
        data: {
          name: node.name,
          type: node.type,
          label: node.label || node.name,
          icon: getNodeIcon(node.type),
          parameters: node.parameters,
          inputs: node.inputs?.map((i) => ({ name: i.name, displayName: i.displayName })) || defaultInputs,
          inputCount: node.inputCount ?? 1,
          outputs: node.outputs?.map((o) => ({ name: o.name, displayName: o.displayName })) || defaultOutputs,
          outputCount: node.outputCount ?? 1,
          group: normalizeNodeGroup(node.group),
          subworkflowId: node.parameters.workflowId as string,
        } as WorkflowNodeData,
      };
    }

    // Create regular workflow node
    // Default I/O for nodes without enriched data (e.g., imported from file)
    // Trigger nodes don't have inputs
    const isTrigger = isTriggerType(node.type);
    const defaultInputs = isTrigger ? [] : [{ name: 'main', displayName: 'Main' }];

    // Type-specific default outputs
    const getDefaultOutputs = (nodeType: string) => {
      switch (nodeType) {
        case 'If':
          return [
            { name: 'true', displayName: 'True' },
            { name: 'false', displayName: 'False' },
          ];
        case 'Switch':
          return [
            { name: 'output0', displayName: 'Output 0' },
            { name: 'output1', displayName: 'Output 1' },
            { name: 'fallback', displayName: 'Fallback' },
          ];
        case 'Loop':
          return [
            { name: 'loop', displayName: 'Loop' },
            { name: 'done', displayName: 'Done' },
          ];
        default:
          return [{ name: 'main', displayName: 'Main' }];
      }
    };
    const defaultOutputs = getDefaultOutputs(node.type);

    return {
      id: node.name,
      type: 'workflowNode',
      position: node.position || { x: 0, y: 0 },
      data: {
        name: node.name,
        type: node.type,
        label: node.label || node.name,
        icon: getNodeIcon(node.type),
        parameters: node.parameters,
        // Use enriched I/O data from backend, or defaults for imported files
        inputs: node.inputs?.map((i) => ({ name: i.name, displayName: i.displayName })) || defaultInputs,
        inputCount: node.inputCount ?? (isTrigger ? 0 : 1),
        outputs: node.outputs?.map((o) => ({ name: o.name, displayName: o.displayName })) || defaultOutputs,
        outputCount: node.outputCount ?? defaultOutputs.length,
        outputStrategy: node.outputStrategy as WorkflowNodeData['outputStrategy'],
        // Node group for styling (normalized from backend array)
        group: normalizeNodeGroup(node.group),
        // Subnode slots for parent nodes (e.g., AIAgent has chatModel, memory, tools)
        ...(node.subnodeSlots ? { subnodeSlots: node.subnodeSlots } : {}),
      } as WorkflowNodeData,
    };
  });

  // Generate unique edge IDs using source-target-handle combination
  // Sanitize to remove spaces/special chars that break SVG marker URL references
  const sanitizeId = (str: string) => str.replace(/[^a-zA-Z0-9_-]/g, '_');

  const edges: Edge[] = api.definition.connections.map((conn) => {
    const isSubnodeEdge = conn.connection_type === 'subnode';
    const edgeId = `edge-${sanitizeId(conn.source_node)}-${sanitizeId(conn.source_output)}-${sanitizeId(conn.target_node)}-${sanitizeId(conn.target_input)}`;

    if (isSubnodeEdge) {
      const slotName = conn.slot_name || conn.target_input;
      return {
        id: edgeId,
        source: conn.source_node,
        target: conn.target_node,
        sourceHandle: conn.source_output || 'config',
        targetHandle: slotName,
        type: 'subnodeEdge',
        data: {
          isSubnodeEdge: true,
          slotName,
          slotType: detectSubnodeType(
            api.definition.nodes.find((n) => n.name === conn.source_node)?.type || '',
            true
          ) || 'tool',
          ...(conn.waypoints ? { waypoints: conn.waypoints } : {}),
        },
      };
    }

    return {
      id: edgeId,
      source: conn.source_node,
      target: conn.target_node,
      sourceHandle: conn.source_output,
      targetHandle: conn.target_input,
      type: 'workflowEdge',
      ...(conn.waypoints ? { data: { waypoints: conn.waypoints } } : {}),
    };
  });

  // Auto-layout subnodes below their parent nodes and mark as stacked
  // Group subnode edges by parent (target) and slot
  const subnodeEdgesByParentSlot = new Map<string, Map<string, string[]>>();
  for (const edge of edges) {
    if (edge.type === 'subnodeEdge' && edge.data?.isSubnodeEdge) {
      const parentId = edge.target;
      const slotName = (edge.data as { slotName?: string }).slotName || edge.targetHandle || '';
      if (!subnodeEdgesByParentSlot.has(parentId)) {
        subnodeEdgesByParentSlot.set(parentId, new Map());
      }
      const slotMap = subnodeEdgesByParentSlot.get(parentId)!;
      if (!slotMap.has(slotName)) {
        slotMap.set(slotName, []);
      }
      slotMap.get(slotName)!.push(edge.source);
    }
  }

  // Position each subnode below its parent slot and mark as stacked
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const [parentId, slotMap] of subnodeEdgesByParentSlot) {
    const parentNode = nodeMap.get(parentId);
    if (!parentNode) continue;

    const parentData = parentNode.data as WorkflowNodeData;
    const slots = parentData.subnodeSlots || [];
    const parentWidth = slots.length > 0 ? Math.max(180, slots.length * 55 + 20) : 64;

    for (const [slotName, subnodeIds] of slotMap) {
      const slotIndex = slots.findIndex((s) => s.name === slotName);
      const slotCenterPercent = slots.length > 0 ? (slotIndex + 0.5) / slots.length : 0.5;
      const slotCenterX = parentNode.position.x + parentWidth * slotCenterPercent;

      subnodeIds.forEach((subnodeId, i) => {
        const subnodeNode = nodeMap.get(subnodeId);
        if (!subnodeNode) return;
        // Offset multiple subnodes horizontally (~55px apart), centered on slot
        const totalWidth = (subnodeIds.length - 1) * 55;
        const offsetX = i * 55 - totalWidth / 2;
        subnodeNode.position = {
          x: slotCenterX + offsetX - 24,
          y: parentNode.position.y + 130,
        };
        (subnodeNode.data as WorkflowNodeData).stacked = true;
      });
    }
  }

  return {
    nodes,
    edges,
    workflowName: api.name,
    workflowId: api.id,
    isActive: api.active,
  };
}

