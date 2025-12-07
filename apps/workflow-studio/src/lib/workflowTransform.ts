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

// Backend types (matching @cmdstd/schemas)
export interface BackendNodeData {
  json: Record<string, unknown>;
  binary?: Record<string, unknown>;
}

export interface BackendNodeDefinition {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  position?: { x: number; y: number };
  continueOnFail?: boolean;
  retryOnFail?: number;
  retryDelay?: number;
  pinnedData?: BackendNodeData[];
}

export interface BackendConnection {
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
};

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
};

/**
 * Get the backend node type for a UI node type
 */
export function toBackendNodeType(uiType: string): string {
  return UI_TO_BACKEND_NODE_TYPE[uiType] || uiType;
}

/**
 * Get the UI node type for a backend node type
 */
export function toUINodeType(backendType: string): string {
  return BACKEND_TO_UI_NODE_TYPE[backendType] || backendType.toLowerCase();
}

// ============================================================================
// Icon Mapping (for loading from backend)
// ============================================================================

const NODE_TYPE_ICONS: Record<string, string> = {
  Start: 'mouse-pointer',
  Cron: 'calendar',
  Webhook: 'webhook',
  ErrorTrigger: 'alert-triangle',
  Set: 'pen',
  Code: 'code',
  If: 'git-branch',
  Switch: 'route',
  Merge: 'git-merge',
  SplitInBatches: 'layers',
  HttpRequest: 'globe',
  Wait: 'clock',
  LLMChat: 'message-square',
  AIAgent: 'bot',
};

export function getNodeIcon(backendType: string): string {
  return NODE_TYPE_ICONS[backendType] || 'code';
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
// Backend → ReactFlow Transformation
// ============================================================================

/**
 * Transforms backend workflow to ReactFlow nodes and edges.
 *
 * @param workflow - Backend workflow format
 * @returns Object with nodes and edges arrays for ReactFlow
 */
export function fromBackendWorkflow(workflow: BackendWorkflow): {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
} {
  // Build a map from node name to generated React Flow ID
  const nameToId = new Map<string, string>();

  // Transform nodes
  const nodes: Node<WorkflowNodeData>[] = workflow.nodes.map((node, index) => {
    const id = `node-${Date.now()}-${index}`;
    nameToId.set(node.name, id);

    const uiType = toUINodeType(node.type);

    return {
      id,
      type: 'workflowNode',
      position: node.position || { x: 250 + index * 200, y: 200 },
      data: {
        name: node.name,
        type: uiType,
        label: node.name, // Use name as label initially
        icon: getNodeIcon(node.type),
        description: getNodeDescription(node.type),
        parameters: node.parameters,
        disabled: false,
        continueOnFail: node.continueOnFail,
        retryOnFail: node.retryOnFail,
        retryDelay: node.retryDelay,
        pinnedData: node.pinnedData,
      },
    };
  });

  // Transform connections to edges
  const edges: Edge[] = workflow.connections.map((conn, index) => ({
    id: `edge-${Date.now()}-${index}`,
    source: nameToId.get(conn.sourceNode) || '',
    target: nameToId.get(conn.targetNode) || '',
    sourceHandle: conn.sourceOutput === 'main' ? null : conn.sourceOutput,
    targetHandle: conn.targetInput === 'main' ? null : conn.targetInput,
    type: 'workflowEdge',
  }));

  return { nodes, edges };
}

/**
 * Get a description for a node type
 */
function getNodeDescription(backendType: string): string {
  const descriptions: Record<string, string> = {
    Start: 'Runs the flow on clicking a button',
    Cron: 'Triggers workflow based on schedule',
    Webhook: 'Runs the flow on receiving an HTTP request',
    ErrorTrigger: 'Triggers when another workflow fails',
    Set: 'Sets values on items',
    Code: 'Run custom JavaScript code',
    If: 'Route items based on conditions',
    Switch: 'Route items based on multiple conditions',
    Merge: 'Merge data from multiple inputs',
    SplitInBatches: 'Split data into batches for processing',
    HttpRequest: 'Makes HTTP requests and returns the response',
    Wait: 'Wait for a specified amount of time',
    LLMChat: 'Make a simple LLM call using Google Gemini',
    AIAgent: 'AI Agent with tool calling capabilities',
  };
  return descriptions[backendType] || 'Configure this node';
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates that all node names are unique
 */
export function validateUniqueNames(nodes: Node<WorkflowNodeData>[]): boolean {
  const names = nodes
    .filter((n) => n.type === 'workflowNode')
    .map((n) => n.data.name);
  return new Set(names).size === names.length;
}

/**
 * Gets all existing node names from the nodes array
 */
export function getExistingNodeNames(nodes: Node<WorkflowNodeData>[]): string[] {
  return nodes
    .filter((n) => n.type === 'workflowNode')
    .map((n) => n.data.name);
}

/**
 * Checks if a node type is a trigger node
 */
export function isTriggerNode(backendType: string): boolean {
  return ['Start', 'Cron', 'Webhook', 'ErrorTrigger'].includes(backendType);
}

/**
 * Checks if workflow has at least one trigger node
 */
export function hasTriggerNode(nodes: Node<WorkflowNodeData>[]): boolean {
  return nodes.some((n) => {
    if (n.type !== 'workflowNode') return false;
    const backendType = toBackendNodeType(n.data.type);
    return isTriggerNode(backendType);
  });
}
