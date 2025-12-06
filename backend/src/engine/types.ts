import type { NodeDefinition, Workflow } from '../schemas/workflow.js';

export interface NodeData {
  json: Record<string, unknown>;
  binary?: Record<string, Buffer>;
}

/**
 * Special signal to indicate a branch produced no output (for Merge node)
 * This prevents Merge from waiting forever on dead branches
 */
export const NO_OUTPUT_SIGNAL = Symbol('NO_OUTPUT');

export interface ExecutionContext {
  workflow: Workflow;
  executionId: string;
  startTime: Date;
  mode: 'manual' | 'webhook' | 'cron';

  // Node execution state
  nodeStates: Map<string, NodeData[]>;

  // For loop support: track execution per iteration
  nodeRunCounts: Map<string, number>;

  // For Merge node: track which inputs have been received
  pendingInputs: Map<string, Map<string, NodeData[] | typeof NO_OUTPUT_SIGNAL>>;

  // For SplitInBatches: stateful node data
  nodeInternalState: Map<string, Record<string, unknown>>;

  // Error tracking
  errors: Array<{ nodeName: string; error: string; timestamp: Date }>;

  // For Wait node webhook resume
  waitingNodes: Map<string, { resolve: (data: NodeData[]) => void }>;
}

/**
 * Multi-output result from node execution
 * Keys are output names: "main", "true", "false", "loop", "done", etc.
 * null value signals that branch should propagate NO_OUTPUT_SIGNAL
 */
export interface NodeExecutionResult {
  outputs: Record<string, NodeData[] | null>;
}

/**
 * Job in the execution queue
 */
export interface ExecutionJob {
  nodeName: string;
  inputData: NodeData[];
  sourceNode: string | null;
  sourceOutput: string;
  runIndex: number;
}

export interface INode {
  readonly type: string;
  readonly description: string;

  /**
   * Number of inputs this node expects (for Merge-like nodes)
   * Default: 1
   */
  readonly inputCount?: number;

  execute(
    context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult>;
}

export type NodeConstructor = new () => INode;

/**
 * Execution record for history
 */
export interface ExecutionRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'success' | 'failed';
  mode: 'manual' | 'webhook' | 'cron';
  startTime: Date;
  endTime?: Date;
  nodeData: Record<string, NodeData[]>;
  errors: Array<{ nodeName: string; error: string; timestamp: Date }>;
}

/**
 * Stored workflow with metadata
 */
export interface StoredWorkflow {
  id: string;
  name: string;
  workflow: Workflow;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
