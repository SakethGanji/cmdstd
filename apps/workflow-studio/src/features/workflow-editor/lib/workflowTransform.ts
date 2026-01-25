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
import { getNodeIcon, normalizeNodeGroup } from './nodeConfig';

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
    (n) => n.type === 'workflowNode'
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

  // Transform edges to connections
  const connections: BackendConnection[] = edges
    .filter((edge) => {
      // Include edges where both source and target are valid nodes
      const sourceName = idToName.get(edge.source);
      const targetName = idToName.get(edge.target);
      return sourceName && targetName;
    })
    .map((edge) => {
      const isSubnodeConnection = subnodeIds.has(edge.source);
      const edgeData = edge.data as { slotName?: string } | undefined;

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
        };
      } else {
        // Normal connection between workflow nodes
        return {
          source_node: idToName.get(edge.source)!,
          source_output: edge.sourceHandle || 'main',
          target_node: idToName.get(edge.target)!,
          target_input: edge.targetHandle || 'main',
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
    .filter((n) => n.type === 'workflowNode')
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
    }>;
    connections: Array<{
      source_node: string;
      target_node: string;
      source_output: string;
      target_input: string;
      connection_type?: 'normal' | 'subnode';
      slot_name?: string;
    }>;
  };
}

// Known subnode type prefixes/patterns for detection
const SUBNODE_TYPE_PATTERNS: Array<{ pattern: RegExp; subnodeType: 'model' | 'memory' | 'tool' }> = [
  { pattern: /Model$/i, subnodeType: 'model' },
  { pattern: /^(Gemini|OpenAI|Anthropic|Claude)/i, subnodeType: 'model' },
  { pattern: /Memory$/i, subnodeType: 'memory' },
  { pattern: /^(Simple|Buffer|Window)Memory/i, subnodeType: 'memory' },
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

    // Create regular workflow node
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
        // Use enriched I/O data from backend
        inputs: node.inputs?.map((i) => ({ name: i.name, displayName: i.displayName })),
        inputCount: node.inputCount ?? 1,
        outputs: node.outputs?.map((o) => ({ name: o.name, displayName: o.displayName })),
        outputCount: node.outputCount ?? 1,
        outputStrategy: node.outputStrategy as WorkflowNodeData['outputStrategy'],
        // Node group for styling (normalized from backend array)
        group: normalizeNodeGroup(node.group),
      } as WorkflowNodeData,
    };
  });

  // Generate unique edge IDs using source-target-handle combination
  const edges: Edge[] = api.definition.connections.map((conn) => {
    const isSubnodeEdge = conn.connection_type === 'subnode';
    const edgeId = `edge-${conn.source_node}-${conn.source_output}-${conn.target_node}-${conn.target_input}`;

    if (isSubnodeEdge) {
      return {
        id: edgeId,
        source: conn.source_node,
        target: conn.target_node,
        sourceHandle: conn.source_output,
        targetHandle: conn.target_input,
        type: 'subnodeEdge',
        data: {
          isSubnodeEdge: true,
          slotName: conn.slot_name || conn.target_input,
          slotType: detectSubnodeType(
            api.definition.nodes.find((n) => n.name === conn.source_node)?.type || '',
            true
          ) || 'tool',
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
    };
  });

  return {
    nodes,
    edges,
    workflowName: api.name,
    workflowId: api.id,
    isActive: api.active,
  };
}

