import type { Node } from 'reactflow';
import type { WorkflowNodeData } from '../../types/workflow';

export type InputType = 'chat' | 'form' | null;
export type OutputType = 'chat' | 'html' | 'text';

export interface UIConfig {
  inputType: InputType;
  inputNode: Node<WorkflowNodeData> | null;
  outputNodes: Node<WorkflowNodeData>[];
  outputTypes: OutputType[];
  welcomeMessage?: string;
  placeholder?: string;
}

// Node types use backend PascalCase format
const INPUT_NODE_TYPES: Record<string, InputType> = {
  ChatInput: 'chat',
  FormInput: 'form',
};

const OUTPUT_NODE_TYPES: Record<string, OutputType> = {
  ChatOutput: 'chat',
  HTMLDisplay: 'html',
  TextDisplay: 'text',
};

/**
 * Scans workflow nodes to detect UI nodes and build configuration
 * for the dynamic UI preview panel.
 */
export function detectUINodes(nodes: Node<WorkflowNodeData>[]): UIConfig {
  // Find input node (trigger)
  const inputNode = nodes.find((n) => INPUT_NODE_TYPES[n.data.type]) ?? null;
  const inputType = inputNode ? INPUT_NODE_TYPES[inputNode.data.type] : null;

  // Find output nodes
  const outputNodes = nodes.filter((n) => OUTPUT_NODE_TYPES[n.data.type]);
  const outputTypes = outputNodes.map((n) => OUTPUT_NODE_TYPES[n.data.type]);

  // Extract config from input node
  const welcomeMessage = inputNode?.data.parameters?.welcomeMessage as string | undefined;
  const placeholder = inputNode?.data.parameters?.placeholder as string | undefined;

  return {
    inputType,
    inputNode,
    outputNodes,
    outputTypes,
    welcomeMessage,
    placeholder,
  };
}

/**
 * Check if a workflow has UI nodes configured
 */
export function hasUINodes(nodes: Node<WorkflowNodeData>[]): boolean {
  return nodes.some((n) => INPUT_NODE_TYPES[n.data.type] || OUTPUT_NODE_TYPES[n.data.type]);
}
