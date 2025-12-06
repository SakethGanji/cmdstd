import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { WorkflowSchema } from '../schemas/workflow.js';
import { WorkflowRunner } from '../engine/WorkflowRunner.js';
import { NodeRegistry } from '../engine/NodeRegistry.js';
import { WorkflowStore } from '../storage/WorkflowStore.js';
import { ExecutionStore } from '../storage/ExecutionStore.js';
import { cronManager, CronManager } from '../nodes/Cron.js';
import { ErrorWorkflowManager } from '../nodes/ErrorTrigger.js';

const runner = new WorkflowRunner();

export async function workflowRoutes(app: FastifyInstance): Promise<void> {
  // ============================================
  // Workflow CRUD
  // ============================================

  /**
   * POST /workflows - Create a new workflow
   */
  app.post('/workflows', async (request, reply) => {
    try {
      const workflow = WorkflowSchema.parse(request.body);
      const stored = WorkflowStore.create(workflow);

      return reply.status(201).send({
        status: 'success',
        workflow: {
          id: stored.id,
          name: stored.name,
          active: stored.active,
          webhookUrl: `/webhook/${stored.id}`,
          createdAt: stored.createdAt.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          status: 'error',
          error: 'Validation failed',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  /**
   * GET /workflows - List all workflows
   */
  app.get('/workflows', async () => {
    const workflows = WorkflowStore.list();

    return {
      workflows: workflows.map((w) => ({
        id: w.id,
        name: w.name,
        active: w.active,
        webhookUrl: `/webhook/${w.id}`,
        nodeCount: w.workflow.nodes.length,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
    };
  });

  /**
   * GET /workflows/:id - Get a workflow
   */
  app.get('/workflows/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const stored = WorkflowStore.get(id);

    if (!stored) {
      return reply.status(404).send({
        status: 'error',
        error: 'Workflow not found',
      });
    }

    return {
      workflow: {
        id: stored.id,
        name: stored.name,
        active: stored.active,
        webhookUrl: `/webhook/${stored.id}`,
        definition: stored.workflow,
        createdAt: stored.createdAt.toISOString(),
        updatedAt: stored.updatedAt.toISOString(),
      },
    };
  });

  /**
   * PUT /workflows/:id - Update a workflow
   */
  app.put('/workflows/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const workflow = WorkflowSchema.parse(request.body);
      const updated = WorkflowStore.update(id, workflow);

      if (!updated) {
        return reply.status(404).send({
          status: 'error',
          error: 'Workflow not found',
        });
      }

      // Re-schedule cron if active
      if (updated.active) {
        setupCronTrigger(updated.id, updated.workflow);
      }

      return {
        status: 'success',
        workflow: {
          id: updated.id,
          name: updated.name,
          active: updated.active,
          updatedAt: updated.updatedAt.toISOString(),
        },
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          status: 'error',
          error: 'Validation failed',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  /**
   * PUT /workflows/:id/active - Toggle workflow active state
   */
  app.put('/workflows/:id/active', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { active } = request.body as { active: boolean };

    const updated = WorkflowStore.setActive(id, active);

    if (!updated) {
      return reply.status(404).send({
        status: 'error',
        error: 'Workflow not found',
      });
    }

    // Setup or cancel cron trigger
    if (active) {
      setupCronTrigger(updated.id, updated.workflow);
    } else {
      cronManager.cancel(updated.id);
    }

    return {
      status: 'success',
      workflow: {
        id: updated.id,
        active: updated.active,
      },
    };
  });

  /**
   * DELETE /workflows/:id - Delete a workflow
   */
  app.delete('/workflows/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    cronManager.cancel(id);
    const deleted = WorkflowStore.delete(id);

    if (!deleted) {
      return reply.status(404).send({
        status: 'error',
        error: 'Workflow not found',
      });
    }

    return { status: 'success' };
  });

  // ============================================
  // Workflow Execution
  // ============================================

  /**
   * POST /workflows/run - Run a workflow directly (without saving)
   */
  app.post('/workflows/run', async (request, reply) => {
    try {
      const workflow = WorkflowSchema.parse(request.body);

      const startNode = runner.findStartNode(workflow);
      if (!startNode) {
        return reply.status(400).send({
          status: 'error',
          error: 'No start node found in workflow',
        });
      }

      const initialData = [
        {
          json: {
            query: request.query,
            body: request.body,
            headers: request.headers,
          },
        },
      ];

      const context = await runner.run(workflow, startNode.name, initialData, 'manual');

      // Store execution
      ExecutionStore.complete(context, workflow.id || 'adhoc', workflow.name);

      // Convert nodeStates Map to object
      const nodeData: Record<string, unknown> = {};
      for (const [nodeName, data] of context.nodeStates) {
        nodeData[nodeName] = data;
      }

      return {
        status: context.errors.length > 0 ? 'failed' : 'success',
        executionId: context.executionId,
        data: nodeData,
        errors: context.errors,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          status: 'error',
          error: 'Validation failed',
          details: error.errors,
        });
      }

      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        status: 'error',
        error: message,
      });
    }
  });

  /**
   * POST /workflows/:id/run - Run a saved workflow
   */
  app.post('/workflows/:id/run', async (request, reply) => {
    const { id } = request.params as { id: string };
    const stored = WorkflowStore.get(id);

    if (!stored) {
      return reply.status(404).send({
        status: 'error',
        error: 'Workflow not found',
      });
    }

    const startNode = runner.findStartNode(stored.workflow);
    if (!startNode) {
      return reply.status(400).send({
        status: 'error',
        error: 'No start node found in workflow',
      });
    }

    const initialData = [
      {
        json: {
          query: request.query,
          body: request.body,
          headers: request.headers,
          triggeredAt: new Date().toISOString(),
        },
      },
    ];

    try {
      const context = await runner.run(stored.workflow, startNode.name, initialData, 'manual');

      // Store execution
      const execution = ExecutionStore.complete(context, stored.id, stored.name);

      // Handle errors - trigger error workflow if configured
      if (context.errors.length > 0) {
        await triggerErrorWorkflow(stored.id, stored.name, context);
      }

      // Convert nodeStates Map to object
      const nodeData: Record<string, unknown> = {};
      for (const [nodeName, data] of context.nodeStates) {
        nodeData[nodeName] = data;
      }

      return {
        status: context.errors.length > 0 ? 'failed' : 'success',
        executionId: execution.id,
        data: nodeData,
        errors: context.errors,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      ExecutionStore.fail(id, message);

      return reply.status(500).send({
        status: 'error',
        error: message,
      });
    }
  });

  // ============================================
  // Webhook Trigger
  // ============================================

  /**
   * Webhook trigger - supports GET, POST, PUT, DELETE
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

      // Convert nodeStates Map to object
      const nodeData: Record<string, unknown> = {};
      for (const [nodeName, data] of context.nodeStates) {
        nodeData[nodeName] = data;
      }

      return {
        status: context.errors.length > 0 ? 'failed' : 'success',
        executionId: context.executionId,
        data: nodeData,
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

  // ============================================
  // Node Information
  // ============================================

  /**
   * GET /nodes - List all available node types
   */
  app.get('/nodes', async () => {
    return {
      nodes: NodeRegistry.getNodeInfo(),
    };
  });
}

// ============================================
// Helper Functions
// ============================================

function setupCronTrigger(workflowId: string, workflow: any): void {
  const cronNode = workflow.nodes.find((n: any) => n.type === 'Cron');
  if (!cronNode) return;

  const interval = cronNode.parameters?.interval || { value: 5, unit: 'minutes' };
  const intervalMs = CronManager.parseInterval(interval);

  cronManager.schedule(workflowId, intervalMs, async () => {
    const stored = WorkflowStore.get(workflowId);
    if (!stored || !stored.active) {
      cronManager.cancel(workflowId);
      return;
    }

    const startNode = cronNode;
    const initialData = [
      {
        json: {
          triggeredAt: new Date().toISOString(),
          mode: 'cron',
        },
      },
    ];

    try {
      const context = await runner.run(stored.workflow, startNode.name, initialData, 'cron');
      ExecutionStore.complete(context, stored.id, stored.name);

      if (context.errors.length > 0) {
        await triggerErrorWorkflow(stored.id, stored.name, context);
      }
    } catch (error) {
      console.error(`Cron execution failed for workflow ${workflowId}:`, error);
    }
  });
}

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
