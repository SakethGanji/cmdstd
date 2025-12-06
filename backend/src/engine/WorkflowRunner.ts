import type { Workflow, NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  ExecutionJob,
  NodeExecutionResult,
} from './types.js';
import { NO_OUTPUT_SIGNAL } from './types.js';
import { NodeRegistry } from './NodeRegistry.js';
import {
  ExpressionEngine,
  expressionEngine,
} from './ExpressionEngine.js';

export class WorkflowRunner {
  /**
   * Run a workflow from a starting node
   */
  async run(
    workflow: Workflow,
    startNodeName: string,
    initialData: NodeData[] = [{ json: {} }],
    mode: 'manual' | 'webhook' | 'cron' = 'manual'
  ): Promise<ExecutionContext> {
    const context = this.createContext(workflow, mode);

    const startNode = workflow.nodes.find((n) => n.name === startNodeName);
    if (!startNode) {
      throw new Error(`Start node "${startNodeName}" not found in workflow`);
    }

    // Initialize job queue with start node
    const queue: ExecutionJob[] = [
      {
        nodeName: startNodeName,
        inputData: initialData,
        sourceNode: null,
        sourceOutput: 'main',
        runIndex: 0,
      },
    ];

    // Process jobs until queue is empty
    while (queue.length > 0) {
      const job = queue.shift()!;
      await this.processJob(context, job, queue);
    }

    return context;
  }

  /**
   * Process a single execution job
   */
  private async processJob(
    context: ExecutionContext,
    job: ExecutionJob,
    queue: ExecutionJob[]
  ): Promise<void> {
    const { nodeName, inputData, sourceNode, sourceOutput, runIndex } = job;
    const nodeDef = context.workflow.nodes.find((n) => n.name === nodeName);

    if (!nodeDef) {
      context.errors.push({
        nodeName,
        error: `Node "${nodeName}" not found`,
        timestamp: new Date(),
      });
      return;
    }

    const node = NodeRegistry.get(nodeDef.type);
    const inputCount = node.inputCount || 1;

    // Handle multi-input nodes (like Merge)
    if (inputCount > 1) {
      const handled = this.handleMultiInputNode(
        context,
        nodeDef,
        inputData,
        sourceNode,
        sourceOutput,
        queue,
        runIndex
      );
      if (!handled) {
        return; // Waiting for more inputs
      }
    }

    // Check for pinned data
    if (nodeDef.pinnedData && nodeDef.pinnedData.length > 0) {
      context.nodeStates.set(nodeName, nodeDef.pinnedData);
      this.queueNextNodes(context, nodeDef, { outputs: { main: nodeDef.pinnedData } }, queue, runIndex);
      return;
    }

    // Resolve expressions in parameters
    const resolvedNodeDef = this.resolveNodeParameters(context, nodeDef, inputData);

    // Execute node with error handling
    let result: NodeExecutionResult;
    try {
      result = await node.execute(context, resolvedNodeDef, inputData);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      context.errors.push({
        nodeName,
        error: errorMsg,
        timestamp: new Date(),
      });

      // Check continueOnFail
      if (nodeDef.continueOnFail) {
        result = {
          outputs: {
            main: [{ json: { error: errorMsg, _errorNode: nodeName } }],
          },
        };
      } else {
        // Propagate NO_OUTPUT to downstream nodes
        this.propagateNoOutput(context, nodeDef, queue, runIndex);
        return;
      }
    }

    // Update run count for loop support
    const currentCount = context.nodeRunCounts.get(nodeName) || 0;
    context.nodeRunCounts.set(nodeName, currentCount + 1);

    // Store node output (main output for state)
    const mainOutput = result.outputs['main'] || result.outputs[Object.keys(result.outputs)[0]];
    if (mainOutput) {
      context.nodeStates.set(nodeName, mainOutput);
    }

    // Queue next nodes based on outputs
    this.queueNextNodes(context, nodeDef, result, queue, runIndex);
  }

  /**
   * Handle nodes that expect multiple inputs (like Merge)
   * Returns true if ready to execute, false if still waiting
   */
  private handleMultiInputNode(
    context: ExecutionContext,
    nodeDef: NodeDefinition,
    inputData: NodeData[],
    sourceNode: string | null,
    sourceOutput: string,
    queue: ExecutionJob[],
    runIndex: number
  ): boolean {
    const nodeKey = `${nodeDef.name}:${runIndex}`;

    if (!context.pendingInputs.has(nodeKey)) {
      context.pendingInputs.set(nodeKey, new Map());
    }

    const pending = context.pendingInputs.get(nodeKey)!;
    const inputKey = sourceNode ? `${sourceNode}:${sourceOutput}` : 'initial';

    pending.set(inputKey, inputData);

    // Count expected inputs from connections
    const expectedInputs = context.workflow.connections.filter(
      (c) => c.targetNode === nodeDef.name
    ).length;

    // Check if we have all inputs
    if (pending.size >= expectedInputs) {
      // Ready to execute - combine all inputs
      return true;
    }

    return false;
  }

  /**
   * Queue next nodes based on node outputs
   */
  private queueNextNodes(
    context: ExecutionContext,
    nodeDef: NodeDefinition,
    result: NodeExecutionResult,
    queue: ExecutionJob[],
    runIndex: number
  ): void {
    for (const [outputName, outputData] of Object.entries(result.outputs)) {
      // Find connections from this output
      const connections = context.workflow.connections.filter(
        (c) => c.sourceNode === nodeDef.name && (c.sourceOutput || 'main') === outputName
      );

      for (const conn of connections) {
        const targetDef = context.workflow.nodes.find((n) => n.name === conn.targetNode);
        if (!targetDef) continue;

        // Determine if this is a loop (going back to earlier node)
        const isLoop = outputName === 'loop';
        const nextRunIndex = isLoop ? runIndex + 1 : runIndex;

        if (outputData === null) {
          // NO_OUTPUT signal - only propagate to multi-input nodes (Merge)
          const targetNode = NodeRegistry.get(targetDef.type);
          if ((targetNode.inputCount || 1) > 1) {
            // Send signal to multi-input node so it knows this branch is dead
            const nodeKey = `${conn.targetNode}:${nextRunIndex}`;
            if (!context.pendingInputs.has(nodeKey)) {
              context.pendingInputs.set(nodeKey, new Map());
            }
            context.pendingInputs.get(nodeKey)!.set(
              `${nodeDef.name}:${outputName}`,
              [] // Empty array signals no data from this branch
            );
          }
          // Don't queue execution for single-input nodes when output is null
        } else if (outputData.length > 0) {
          queue.push({
            nodeName: conn.targetNode,
            inputData: outputData,
            sourceNode: nodeDef.name,
            sourceOutput: outputName,
            runIndex: nextRunIndex,
          });
        }
        // Empty array = no output, don't queue
      }
    }
  }

  /**
   * Propagate NO_OUTPUT signal to all downstream nodes
   */
  private propagateNoOutput(
    context: ExecutionContext,
    nodeDef: NodeDefinition,
    queue: ExecutionJob[],
    runIndex: number
  ): void {
    const connections = context.workflow.connections.filter(
      (c) => c.sourceNode === nodeDef.name
    );

    for (const conn of connections) {
      const targetDef = context.workflow.nodes.find((n) => n.name === conn.targetNode);
      if (!targetDef) continue;

      const targetNode = NodeRegistry.get(targetDef.type);

      // If target is multi-input, send NO_OUTPUT signal
      if ((targetNode.inputCount || 1) > 1) {
        const nodeKey = `${conn.targetNode}:${runIndex}`;
        if (!context.pendingInputs.has(nodeKey)) {
          context.pendingInputs.set(nodeKey, new Map());
        }
        context.pendingInputs.get(nodeKey)!.set(
          `${nodeDef.name}:${conn.sourceOutput || 'main'}`,
          NO_OUTPUT_SIGNAL as any
        );
      }
    }
  }

  /**
   * Resolve expressions in node parameters
   */
  private resolveNodeParameters(
    context: ExecutionContext,
    nodeDef: NodeDefinition,
    inputData: NodeData[]
  ): NodeDefinition {
    const exprContext = ExpressionEngine.createContext(
      inputData,
      context.nodeStates,
      context.executionId,
      0
    );

    return {
      ...nodeDef,
      parameters: expressionEngine.resolve(nodeDef.parameters, exprContext),
    };
  }

  /**
   * Create fresh execution context
   */
  private createContext(
    workflow: Workflow,
    mode: 'manual' | 'webhook' | 'cron'
  ): ExecutionContext {
    return {
      workflow,
      executionId: this.generateId(),
      startTime: new Date(),
      mode,
      nodeStates: new Map(),
      nodeRunCounts: new Map(),
      pendingInputs: new Map(),
      nodeInternalState: new Map(),
      errors: [],
      waitingNodes: new Map(),
    };
  }

  /**
   * Find start node in workflow
   */
  findStartNode(workflow: Workflow): NodeDefinition | undefined {
    return (
      workflow.nodes.find((n) => n.type === 'Webhook') ||
      workflow.nodes.find((n) => n.type === 'Cron') ||
      workflow.nodes.find((n) => n.type === 'Start') ||
      workflow.nodes[0]
    );
  }

  private generateId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
