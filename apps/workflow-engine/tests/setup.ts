/**
 * Test Setup - Utilities for workflow engine integration tests
 */
import type { Workflow, NodeDefinition, Connection } from '../src/schemas/workflow.js';
import { WorkflowStore } from '../src/storage/WorkflowStore.js';
import { ExecutionStore } from '../src/storage/ExecutionStore.js';
import { WorkflowRunner } from '../src/engine/WorkflowRunner.js';
import { NodeRegistry } from '../src/engine/NodeRegistry.js';

// Create a singleton runner for tests
export const runner = new WorkflowRunner();

/**
 * Reset all stores before each test
 */
export function resetStores(): void {
  WorkflowStore.clear();
  ExecutionStore.clear();
}

/**
 * Helper to create a workflow definition
 */
export function createWorkflow(
  name: string,
  nodes: NodeDefinition[],
  connections: Connection[] = []
): Workflow {
  return {
    name,
    nodes,
    connections,
  };
}

/**
 * Helper to create a node definition
 */
export function createNode(
  name: string,
  type: string,
  parameters: Record<string, unknown> = {},
  options: Partial<NodeDefinition> = {}
): NodeDefinition {
  return {
    name,
    type,
    parameters,
    continueOnFail: false,
    retryOnFail: 0,
    retryDelay: 1000,
    ...options,
  };
}

/**
 * Helper to create a connection
 */
export function createConnection(
  sourceNode: string,
  targetNode: string,
  sourceOutput: string = 'main',
  targetInput: string = 'main'
): Connection {
  return {
    sourceNode,
    sourceOutput,
    targetNode,
    targetInput,
  };
}

/**
 * Run a workflow and return the execution context
 */
export async function runWorkflow(
  workflow: Workflow,
  startNodeName?: string,
  initialData: Array<{ json: Record<string, unknown> }> = [{ json: {} }]
) {
  const startNode = startNodeName || runner.findStartNode(workflow)?.name;
  if (!startNode) {
    throw new Error('No start node found');
  }
  return runner.run(workflow, startNode, initialData, 'manual');
}

/**
 * Get node output from execution context
 */
export function getNodeOutput(
  context: Awaited<ReturnType<typeof runWorkflow>>,
  nodeName: string
) {
  return context.nodeStates.get(nodeName);
}

/**
 * Export stores and registry for direct access in tests
 */
export { WorkflowStore, ExecutionStore, NodeRegistry };
