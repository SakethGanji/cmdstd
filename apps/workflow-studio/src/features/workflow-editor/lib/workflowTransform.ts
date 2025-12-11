/**
 * Workflow Transformation Utilities
 *
 * Transforms between ReactFlow format (UI) and Backend API format.
 * The key differences:
 * - UI uses node.id (React Flow generated), backend uses node.name
 * - UI uses edge.source/target, backend uses connection.sourceNode/targetNode
 * - UI node types use camelCase, backend uses PascalCase
 */

import type { Node, Edge } from 'reactflow';
import type { WorkflowNodeData } from '../types/workflow';

// Backend types (internal)
interface BackendNodeData {
  json: Record<string, unknown>;
  binary?: Record<string, unknown>;
}

interface BackendNodeDefinition {
  name: string;
  type: string;
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
}

export interface BackendWorkflow {
  id?: string;
  name: string;
  nodes: BackendNodeDefinition[];
  connections: BackendConnection[];
}

// ============================================================================
// Node Type Mapping
// ============================================================================

/**
 * Maps UI node types (camelCase) to backend node types (PascalCase)
 */
const UI_TO_BACKEND_NODE_TYPE: Record<string, string> = {
  // Triggers
  manualTrigger: 'Start',
  scheduleTrigger: 'Cron',
  cronTrigger: 'Cron',
  webhook: 'Webhook',
  errorTrigger: 'ErrorTrigger',

  // Transform
  set: 'Set',
  code: 'Code',
  // Note: 'filter' doesn't exist in backend - remove from UI or implement in backend

  // Flow
  if: 'If',
  switch: 'Switch',
  merge: 'Merge',
  splitInBatches: 'SplitInBatches',

  // Helpers
  httpRequest: 'HttpRequest',
  wait: 'Wait',

  // AI
  llmChat: 'LLMChat',
  aiAgent: 'AIAgent',

  // Data/File
  readFile: 'ReadFile',
  pandasExplore: 'PandasExplore',
  htmlDisplay: 'HTMLDisplay',
};

/**
 * Get the backend node type for a UI node type
 */
function toBackendNodeType(uiType: string): string {
  return UI_TO_BACKEND_NODE_TYPE[uiType] || uiType;
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
  // Filter to only workflow nodes (exclude addNodes placeholder and sticky notes)
  const workflowNodes = nodes.filter(
    (n) => n.type === 'workflowNode'
  ) as Node<WorkflowNodeData>[];

  // Build a map from React Flow node ID to node name (for connection mapping)
  const idToName = new Map<string, string>();
  workflowNodes.forEach((node) => {
    idToName.set(node.id, node.data.name);
  });

  // Transform nodes
  const backendNodes: BackendNodeDefinition[] = workflowNodes.map((node) => ({
    name: node.data.name,
    type: toBackendNodeType(node.data.type),
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

  // Transform edges to connections
  const connections: BackendConnection[] = edges
    .filter((edge) => {
      // Only include edges between workflow nodes
      const sourceName = idToName.get(edge.source);
      const targetName = idToName.get(edge.target);
      return sourceName && targetName;
    })
    .map((edge) => ({
      source_node: idToName.get(edge.source)!,
      source_output: edge.sourceHandle || 'main',
      target_node: idToName.get(edge.target)!,
      target_input: edge.targetHandle || 'main',
    }));

  return {
    id: workflowId,
    name: workflowName,
    nodes: backendNodes,
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
 * Maps backend node types (PascalCase) to UI node types (camelCase)
 */
const BACKEND_TO_UI_NODE_TYPE: Record<string, string> = {
  Start: 'manualTrigger',
  Cron: 'scheduleTrigger',
  Webhook: 'webhook',
  ErrorTrigger: 'errorTrigger',
  Set: 'set',
  Code: 'code',
  If: 'if',
  Switch: 'switch',
  Merge: 'merge',
  SplitInBatches: 'splitInBatches',
  HttpRequest: 'httpRequest',
  Wait: 'wait',
  LLMChat: 'llmChat',
  AIAgent: 'aiAgent',
  ReadFile: 'readFile',
  PandasExplore: 'pandasExplore',
  HTMLDisplay: 'htmlDisplay',
};

function toUINodeType(backendType: string): string {
  return BACKEND_TO_UI_NODE_TYPE[backendType] || backendType;
}

/**
 * Get icon for a node type
 */
function getIconForType(backendType: string): string {
  const iconMap: Record<string, string> = {
    Start: 'mouse-pointer',
    Webhook: 'webhook',
    Cron: 'clock',
    ErrorTrigger: 'alert-triangle',
    HttpRequest: 'globe',
    Set: 'pen',
    Code: 'code',
    If: 'git-branch',
    Switch: 'route',
    Merge: 'git-merge',
    Wait: 'clock',
    SplitInBatches: 'layers',
    LLMChat: 'message-square',
    AIAgent: 'bot',
  };
  return iconMap[backendType] || 'code';
}

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
      parameters: Record<string, unknown>;
      position?: { x: number; y: number };
    }>;
    connections: Array<{
      source_node: string;
      target_node: string;
      source_output: string;
      target_input: string;
    }>;
  };
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
  // Build name to ID map (we use the name as the ID for simplicity)
  const nodes: Node<WorkflowNodeData>[] = api.definition.nodes.map((node) => ({
    id: node.name,
    type: 'workflowNode',
    position: node.position || { x: 0, y: 0 },
    data: {
      name: node.name,
      type: toUINodeType(node.type),
      label: node.name,
      icon: getIconForType(node.type),
      parameters: node.parameters,
    },
  }));

  const edges: Edge[] = api.definition.connections.map((conn, index) => ({
    id: `edge-${index}`,
    source: conn.source_node,
    target: conn.target_node,
    sourceHandle: conn.source_output,
    targetHandle: conn.target_input,
    type: 'workflowEdge',
  }));

  return {
    nodes,
    edges,
    workflowName: api.name,
    workflowId: api.id,
    isActive: api.active,
  };
}

