import type { Node, Edge } from 'reactflow';

// Node data types
export interface WorkflowNodeData {
  label: string;
  type: string;
  icon?: string;
  description?: string;
  parameters?: Record<string, unknown>;
  disabled?: boolean;
}

export interface AddNodesButtonData {
  label: string;
}

// Custom node types
export type WorkflowNode = Node<WorkflowNodeData, 'workflowNode'>;
export type AddNodesNode = Node<AddNodesButtonData, 'addNodes'>;
export type CanvasNode = WorkflowNode | AddNodesNode;

// Edge types
export type WorkflowEdge = Edge;

// Node definition for the node creator panel
export interface NodeDefinition {
  type: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  category: 'trigger' | 'action' | 'transform' | 'flow' | 'helper';
  subcategory?: string;
}

// Node creator view types
export type NodeCreatorView = 'trigger' | 'regular' | 'ai';

// Execution data
export interface ExecutionData {
  items: Record<string, unknown>[];
  error?: string;
}

export interface NodeExecutionData {
  input: ExecutionData | null;
  output: ExecutionData | null;
  startTime?: number;
  endTime?: number;
  status: 'idle' | 'running' | 'success' | 'error';
}
