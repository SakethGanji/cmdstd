import type { Workflow, NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  ExecutionJob,
  NodeExecutionResult,
  ExecutionEvent,
  ExecutionEventCallback,
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
   * @param onEvent - Optional callback for real-time execution events
   */
  async run(
    workflow: Workflow,
    startNodeName: string,
    initialData: NodeData[] = [{ json: {} }],
    mode: 'manual' | 'webhook' | 'cron' = 'manual',
    onEvent?: ExecutionEventCallback
  ): Promise<ExecutionContext> {
    const context = this.createContext(workflow, mode);
    const totalNodes = workflow.nodes.length;
    let completedNodes = 0;

    // Emit execution start event
    this.emitEvent(onEvent, {
      type: 'execution:start',
      executionId: context.executionId,
      timestamp: new Date(),
      progress: { completed: 0, total: totalNodes },
    });

    const startNode = workflow.nodes.find((n) => n.name === startNodeName);
    if (!startNode) {
      const error = `Start node "${startNodeName}" not found in workflow`;
      this.emitEvent(onEvent, {
        type: 'execution:error',
        executionId: context.executionId,
        timestamp: new Date(),
        error,
      });
      throw new Error(error);
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

    // Track which nodes have been executed (for progress tracking)
    const executedNodes = new Set<string>();

    // Process jobs until queue is empty
    // Safety limit to prevent infinite loops
    let iteration = 0;
    const maxIterations = 1000;
    while (queue.length > 0 && iteration < maxIterations) {
      iteration++;
      const job = queue.shift()!;

      // Emit node start event (only first time for each node)
      const nodeDef = context.workflow.nodes.find((n) => n.name === job.nodeName);
      if (nodeDef && !executedNodes.has(job.nodeName)) {
        this.emitEvent(onEvent, {
          type: 'node:start',
          executionId: context.executionId,
          timestamp: new Date(),
          nodeName: job.nodeName,
          nodeType: nodeDef.type,
          progress: { completed: completedNodes, total: totalNodes },
        });
      }

      const hadError = await this.processJob(context, job, queue, onEvent);

      // Track completion and emit node complete event
      if (!executedNodes.has(job.nodeName)) {
        executedNodes.add(job.nodeName);
        completedNodes++;

        if (!hadError && nodeDef) {
          this.emitEvent(onEvent, {
            type: 'node:complete',
            executionId: context.executionId,
            timestamp: new Date(),
            nodeName: job.nodeName,
            nodeType: nodeDef.type,
            data: context.nodeStates.get(job.nodeName),
            progress: { completed: completedNodes, total: totalNodes },
          });
        }
      }
    }

    if (iteration >= maxIterations) {
      const error = 'Execution exceeded maximum iterations (possible infinite loop)';
      context.errors.push({
        nodeName: 'WorkflowRunner',
        error,
        timestamp: new Date(),
      });
      this.emitEvent(onEvent, {
        type: 'execution:error',
        executionId: context.executionId,
        timestamp: new Date(),
        error,
      });
    }

    // Emit execution complete event
    this.emitEvent(onEvent, {
      type: 'execution:complete',
      executionId: context.executionId,
      timestamp: new Date(),
      progress: { completed: completedNodes, total: totalNodes },
    });

    return context;
  }

  /**
   * Helper to emit events safely
   */
  private emitEvent(onEvent: ExecutionEventCallback | undefined, event: ExecutionEvent): void {
    if (onEvent) {
      try {
        onEvent(event);
      } catch (e) {
        console.error('Error in execution event callback:', e);
      }
    }
  }

  /**
   * Process a single execution job
   * @returns true if there was an error, false otherwise
   */
  private async processJob(
    context: ExecutionContext,
    job: ExecutionJob,
    queue: ExecutionJob[],
    onEvent?: ExecutionEventCallback
  ): Promise<boolean> {
    const { nodeName, inputData, sourceNode, sourceOutput, runIndex } = job;
    const nodeDef = context.workflow.nodes.find((n) => n.name === nodeName);

    if (!nodeDef) {
      const error = `Node "${nodeName}" not found`;
      context.errors.push({
        nodeName,
        error,
        timestamp: new Date(),
      });
      this.emitEvent(onEvent, {
        type: 'node:error',
        executionId: context.executionId,
        timestamp: new Date(),
        nodeName,
        error,
      });
      return true;
    }

    const node = NodeRegistry.get(nodeDef.type);
    const inputCount = node.inputCount || 1;

    // Handle multi-input nodes (like Merge)
    // inputCount > 1 or Infinity means this node expects multiple inputs
    if (inputCount > 1 || inputCount === Infinity) {
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
        return false; // Waiting for more inputs
      }
    }

    // Check for pinned data
    if (nodeDef.pinnedData && nodeDef.pinnedData.length > 0) {
      context.nodeStates.set(nodeName, nodeDef.pinnedData);
      this.queueNextNodes(context, nodeDef, { outputs: { main: nodeDef.pinnedData } }, queue, runIndex);
      return false;
    }

    // Resolve expressions in parameters
    const resolvedNodeDef = this.resolveNodeParameters(context, nodeDef, inputData);

    // Execute node with retry and error handling
    let result: NodeExecutionResult | null = null;
    const maxRetries = nodeDef.retryOnFail ?? 0;
    const retryDelay = nodeDef.retryDelay ?? 1000;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        result = await node.execute(context, resolvedNodeDef, inputData);
        lastError = null;
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this is not the last attempt, wait and retry
        if (attempt < maxRetries) {
          await this.delay(retryDelay);
          continue;
        }
      }
    }

    // Handle final error after all retries exhausted
    if (lastError || !result) {
      const errorMsg = lastError?.message ?? 'Unknown execution error';
      context.errors.push({
        nodeName,
        error: `${errorMsg}${maxRetries > 0 ? ` (after ${maxRetries + 1} attempts)` : ''}`,
        timestamp: new Date(),
      });

      this.emitEvent(onEvent, {
        type: 'node:error',
        executionId: context.executionId,
        timestamp: new Date(),
        nodeName,
        nodeType: nodeDef.type,
        error: errorMsg,
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
        return true;
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
    return false;
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
    _queue: ExecutionJob[],
    runIndex: number
  ): boolean {
    const nodeKey = `${nodeDef.name}:${runIndex}`;

    if (!context.pendingInputs.has(nodeKey)) {
      context.pendingInputs.set(nodeKey, new Map());
    }

    const pending = context.pendingInputs.get(nodeKey)!;
    const inputKey = sourceNode ? `${sourceNode}:${sourceOutput}` : 'initial';

    pending.set(inputKey, inputData);

    // Get unique connection keys (sourceNode:sourceOutput combinations)
    // This correctly handles cases where same node has multiple outputs to this node
    const expectedConnections = context.workflow.connections
      .filter((c) => c.targetNode === nodeDef.name)
      .map((c) => `${c.sourceNode}:${c.sourceOutput || 'main'}`);

    const uniqueExpectedInputs = new Set(expectedConnections).size;

    // Check if we have all inputs (including NO_OUTPUT signals)
    if (pending.size >= uniqueExpectedInputs) {
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
          const targetInputCount = targetNode.inputCount || 1;
          if (targetInputCount > 1 || targetInputCount === Infinity) {
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
    _queue: ExecutionJob[],
    runIndex: number
  ): void {
    const connections = context.workflow.connections.filter(
      (c) => c.sourceNode === nodeDef.name
    );

    for (const conn of connections) {
      const targetDef = context.workflow.nodes.find((n) => n.name === conn.targetNode);
      if (!targetDef) continue;

      const targetNode = NodeRegistry.get(targetDef.type);
      const targetInputCount = targetNode.inputCount || 1;

      // If target is multi-input, send NO_OUTPUT signal
      if (targetInputCount > 1 || targetInputCount === Infinity) {
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
