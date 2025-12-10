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
  sourceNode: string;
  sourceOutput: string;
  targetNode: string;
  targetInput: string;
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
 * These are used when a new node is created to ensure required fields have values.
 */
export function getDefaultParameters(backendType: string): Record<string, unknown> {
  const defaults: Record<string, Record<string, unknown>> = {
    LLMChat: {
      model: 'gemini-2.5-flash',
      systemPrompt: '',
      userPrompt: '',
      temperature: 0.7,
      maxTokens: 1024,
    },
    AIAgent: {
      model: 'gemini-2.5-flash',
      systemPrompt: 'You are a helpful assistant. Use the available tools when needed to complete tasks.',
      userPrompt: '',
      tools: '["http_request", "calculate", "get_current_time"]',
      maxIterations: 10,
      temperature: 0.7,
      maxTokens: 2048,
    },
    HttpRequest: {
      method: 'GET',
      url: '',
      responseType: 'json',
    },
    ReadFile: {
      filePath: '',
    },
    PandasExplore: {
      filePath: '={{ $json.filePath }}',
      analysisType: 'profile',
    },
    HTMLDisplay: {
      htmlField: 'html',
    },
  };

  return defaults[backendType] || {};
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
      sourceNode: idToName.get(edge.source)!,
      sourceOutput: edge.sourceHandle || 'main',
      targetNode: idToName.get(edge.target)!,
      targetInput: edge.targetHandle || 'main',
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

