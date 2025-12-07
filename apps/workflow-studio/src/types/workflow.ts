import type { Node, Edge } from 'reactflow';

// Node data types - aligned with backend schema
export interface WorkflowNodeData {
  // Required fields for backend compatibility
  name: string;           // Unique identifier used in connections (maps to backend node.name)
  type: string;           // Node type (e.g., 'HttpRequest', 'If', 'Code')

  // Display fields
  label: string;          // Display name shown in UI (can differ from name)
  icon?: string;
  description?: string;

  // Node configuration
  parameters?: Record<string, unknown>;
  disabled?: boolean;

  // Error handling options
  continueOnFail?: boolean;
  retryOnFail?: number;   // 0-10
  retryDelay?: number;    // ms

  // Pinned data for testing (format: { json: {...} }[])
  pinnedData?: Array<{ json: Record<string, unknown> }>;

  // For sticky notes (UI-only)
  content?: string;
  color?: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
}

export interface AddNodesButtonData {
  label: string;
}

export interface StickyNoteData {
  content: string;
  color: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
}

// Custom node types
export type WorkflowNode = Node<WorkflowNodeData, 'workflowNode'>;
export type AddNodesNode = Node<AddNodesButtonData, 'addNodes'>;
export type StickyNoteNode = Node<StickyNoteData, 'stickyNote'>;
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
