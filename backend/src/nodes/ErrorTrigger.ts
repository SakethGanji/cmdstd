import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import { BaseNode } from './BaseNode.js';

/**
 * ErrorTrigger node - entry point for error handling workflows
 * This node is triggered when another workflow fails
 */
export class ErrorTriggerNode extends BaseNode {
  readonly type = 'ErrorTrigger';
  readonly description = 'Trigger a workflow when another workflow fails';

  async execute(
    _context: ExecutionContext,
    _nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    // ErrorTrigger passes through the error data
    // The input data contains error information from the failed workflow
    return this.output(inputData.length > 0 ? inputData : [{ json: {} }]);
  }
}

/**
 * Error workflow manager - tracks error handler workflows
 */
class ErrorWorkflowManagerClass {
  // Map of workflowId -> errorHandlerWorkflowId
  private handlers = new Map<string, string>();
  // Global error handler (catches all unhandled errors)
  private globalHandler: string | null = null;

  /**
   * Register an error handler for a specific workflow
   */
  register(workflowId: string, errorHandlerWorkflowId: string): void {
    this.handlers.set(workflowId, errorHandlerWorkflowId);
  }

  /**
   * Set global error handler
   */
  setGlobalHandler(workflowId: string): void {
    this.globalHandler = workflowId;
  }

  /**
   * Get error handler for a workflow
   */
  getHandler(workflowId: string): string | null {
    return this.handlers.get(workflowId) || this.globalHandler;
  }

  /**
   * Remove error handler registration
   */
  unregister(workflowId: string): void {
    this.handlers.delete(workflowId);
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.globalHandler = null;
  }

  /**
   * Create error data for triggering error workflow
   */
  createErrorData(
    failedWorkflowId: string,
    failedWorkflowName: string,
    executionId: string,
    errors: Array<{ nodeName: string; error: string; timestamp: Date }>
  ): NodeData {
    return {
      json: {
        failedWorkflow: {
          id: failedWorkflowId,
          name: failedWorkflowName,
          executionId,
        },
        errors: errors.map((e) => ({
          nodeName: e.nodeName,
          message: e.error,
          timestamp: e.timestamp.toISOString(),
        })),
        timestamp: new Date().toISOString(),
      },
    };
  }
}

export const ErrorWorkflowManager = new ErrorWorkflowManagerClass();
