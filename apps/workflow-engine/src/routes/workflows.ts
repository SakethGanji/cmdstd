import type { FastifyInstance } from 'fastify';
import { WorkflowRunner } from '../engine/WorkflowRunner.js';
import { WorkflowStore } from '../storage/WorkflowStore.js';
import { ExecutionStore } from '../storage/ExecutionStore.js';
import { cronManager, CronManager } from '../nodes/Cron.js';
import { ErrorWorkflowManager } from '../nodes/ErrorTrigger.js';

const runner = new WorkflowRunner();

/**
 * REST routes for webhooks and node info only.
 * All other CRUD operations go through tRPC.
 */
export async function workflowRoutes(app: FastifyInstance): Promise<void> {
  // ============================================
  // Webhook Trigger (must be REST for external callers)
  // ============================================

  /**
   * Webhook trigger - supports GET, POST, PUT, DELETE
   * External services (Stripe, GitHub, etc.) call this endpoint
   */
  const webhookHandler = async (request: any, reply: any) => {
    const { workflowId } = request.params as { workflowId: string };
    const stored = WorkflowStore.get(workflowId);

    if (!stored) {
      return reply.status(404).send({
        status: 'error',
        error: 'Workflow not found',
      });
    }

    if (!stored.active) {
      return reply.status(400).send({
        status: 'error',
        error: 'Workflow is not active',
      });
    }

    // Find webhook node
    const webhookNode = stored.workflow.nodes.find((n) => n.type === 'Webhook');
    const startNode = webhookNode || runner.findStartNode(stored.workflow);

    if (!startNode) {
      return reply.status(400).send({
        status: 'error',
        error: 'No start node found in workflow',
      });
    }

    const initialData = [
      {
        json: {
          method: request.method,
          query: request.query,
          body: request.body,
          headers: request.headers,
          params: request.params,
          triggeredAt: new Date().toISOString(),
        },
      },
    ];

    try {
      const context = await runner.run(
        stored.workflow,
        startNode.name,
        initialData,
        'webhook'
      );

      ExecutionStore.complete(context, stored.id, stored.name);

      if (context.errors.length > 0) {
        await triggerErrorWorkflow(stored.id, stored.name, context);
      }

      // Check webhook response mode
      const responseMode = webhookNode?.parameters?.responseMode || 'onReceived';

      if (responseMode === 'lastNode') {
        // Return last node's output
        const nodeNames = Array.from(context.nodeStates.keys());
        const lastNodeName = nodeNames[nodeNames.length - 1];
        const lastNodeData = context.nodeStates.get(lastNodeName);

        return {
          status: context.errors.length > 0 ? 'failed' : 'success',
          data: lastNodeData?.[0]?.json || {},
        };
      }

      // Default: return execution summary
      return {
        status: context.errors.length > 0 ? 'failed' : 'success',
        executionId: context.executionId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        status: 'error',
        error: message,
      });
    }
  };

  app.get('/webhook/:workflowId', webhookHandler);
  app.post('/webhook/:workflowId', webhookHandler);
  app.put('/webhook/:workflowId', webhookHandler);
  app.delete('/webhook/:workflowId', webhookHandler);
}

// ============================================
// Helper Functions
// ============================================

async function triggerErrorWorkflow(
  workflowId: string,
  workflowName: string,
  context: any
): Promise<void> {
  const errorHandlerId = ErrorWorkflowManager.getHandler(workflowId);
  if (!errorHandlerId) return;

  const errorWorkflow = WorkflowStore.get(errorHandlerId);
  if (!errorWorkflow || !errorWorkflow.active) return;

  const errorTrigger = errorWorkflow.workflow.nodes.find(
    (n) => n.type === 'ErrorTrigger'
  );
  if (!errorTrigger) return;

  const errorData = ErrorWorkflowManager.createErrorData(
    workflowId,
    workflowName,
    context.executionId,
    context.errors
  );

  const runner = new WorkflowRunner();

  try {
    const errorContext = await runner.run(
      errorWorkflow.workflow,
      errorTrigger.name,
      [errorData],
      'manual'
    );
    ExecutionStore.complete(errorContext, errorWorkflow.id, errorWorkflow.name);
  } catch (error) {
    console.error('Error workflow failed:', error);
  }
}

// Export for use in tRPC routes (cron scheduling)
export { cronManager, CronManager };
