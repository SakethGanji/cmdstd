import type { FastifyInstance } from 'fastify';
import { WorkflowSchema, type Workflow } from '../schemas/workflow.js';
import { WorkflowStore } from '../storage/WorkflowStore.js';
import { WorkflowRunner } from '../engine/WorkflowRunner.js';
import { ExecutionStore } from '../storage/ExecutionStore.js';
import { NodeRegistry } from '../engine/NodeRegistry.js';
import { workflowValidator } from '../engine/WorkflowValidator.js';

const runner = new WorkflowRunner();

/**
 * Validate workflow and return error response if invalid
 */
function validateWorkflow(workflow: Workflow): { valid: true } | { valid: false; error: string } {
  const result = workflowValidator.validate(workflow);

  if (!result.valid) {
    const errorMessages = result.errors.map((e) => e.message).join('; ');
    return { valid: false, error: `Invalid workflow: ${errorMessages}` };
  }

  return { valid: true };
}

/**
 * REST API routes (replaces tRPC)
 */
export async function apiRoutes(app: FastifyInstance): Promise<void> {
  // ============================================
  // Workflows API
  // ============================================

  // List all workflows
  app.get('/api/workflows', async () => {
    const workflows = WorkflowStore.list();

    return workflows.map((w) => ({
      id: w.id,
      name: w.name,
      active: w.active,
      webhookUrl: `/webhook/${w.id}`,
      nodeCount: w.workflow.nodes.length,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    }));
  });

  // Get a single workflow by ID
  app.get<{ Params: { id: string } }>('/api/workflows/:id', async (request, reply) => {
    const { id } = request.params;
    const stored = WorkflowStore.get(id);

    if (!stored) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    return {
      id: stored.id,
      name: stored.name,
      active: stored.active,
      webhookUrl: `/webhook/${stored.id}`,
      definition: stored.workflow,
      createdAt: stored.createdAt.toISOString(),
      updatedAt: stored.updatedAt.toISOString(),
    };
  });

  // Create a new workflow
  app.post<{ Body: Workflow }>('/api/workflows', async (request, reply) => {
    const parseResult = WorkflowSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.message });
    }

    const workflow = parseResult.data;
    const validation = validateWorkflow(workflow);

    if (!validation.valid) {
      return reply.status(400).send({ error: validation.error });
    }

    const stored = WorkflowStore.create(workflow);

    return {
      id: stored.id,
      name: stored.name,
      active: stored.active,
      webhookUrl: `/webhook/${stored.id}`,
      createdAt: stored.createdAt.toISOString(),
    };
  });

  // Update a workflow
  app.put<{ Params: { id: string }; Body: Workflow }>('/api/workflows/:id', async (request, reply) => {
    const { id } = request.params;
    const parseResult = WorkflowSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.message });
    }

    const workflow = parseResult.data;
    const validation = validateWorkflow(workflow);

    if (!validation.valid) {
      return reply.status(400).send({ error: validation.error });
    }

    const updated = WorkflowStore.update(id, workflow);

    if (!updated) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    return {
      id: updated.id,
      name: updated.name,
      active: updated.active,
      updatedAt: updated.updatedAt.toISOString(),
    };
  });

  // Delete a workflow
  app.delete<{ Params: { id: string } }>('/api/workflows/:id', async (request, reply) => {
    const { id } = request.params;
    const deleted = WorkflowStore.delete(id);

    if (!deleted) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    return { success: true };
  });

  // Toggle active state
  app.patch<{ Params: { id: string }; Body: { active: boolean } }>(
    '/api/workflows/:id/active',
    async (request, reply) => {
      const { id } = request.params;
      const { active } = request.body;

      if (typeof active !== 'boolean') {
        return reply.status(400).send({ error: 'active must be a boolean' });
      }

      const updated = WorkflowStore.setActive(id, active);

      if (!updated) {
        return reply.status(404).send({ error: 'Workflow not found' });
      }

      return {
        id: updated.id,
        active: updated.active,
      };
    }
  );

  // Run a saved workflow
  app.post<{ Params: { id: string } }>('/api/workflows/:id/run', async (request, reply) => {
    const { id } = request.params;
    const stored = WorkflowStore.get(id);

    if (!stored) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const startNode = runner.findStartNode(stored.workflow);
    if (!startNode) {
      return reply.status(400).send({ error: 'No start node found in workflow' });
    }

    const initialData = [
      {
        json: {
          triggeredAt: new Date().toISOString(),
          mode: 'manual',
        },
      },
    ];

    const context = await runner.run(stored.workflow, startNode.name, initialData, 'manual');
    const execution = ExecutionStore.complete(context, stored.id, stored.name);

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
  });

  // Run an ad-hoc workflow (without saving)
  app.post<{ Body: Workflow }>('/api/workflows/run-adhoc', async (request, reply) => {
    const parseResult = WorkflowSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.message });
    }

    const workflow = parseResult.data;
    const validation = validateWorkflow(workflow);

    if (!validation.valid) {
      return reply.status(400).send({ error: validation.error });
    }

    const startNode = runner.findStartNode(workflow);
    if (!startNode) {
      return reply.status(400).send({ error: 'No start node found in workflow' });
    }

    const initialData = [
      {
        json: {
          triggeredAt: new Date().toISOString(),
          mode: 'manual',
        },
      },
    ];

    const context = await runner.run(workflow, startNode.name, initialData, 'manual');
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
  });

  // ============================================
  // Executions API
  // ============================================

  // List all executions
  app.get<{ Querystring: { workflowId?: string } }>('/api/executions', async (request) => {
    const { workflowId } = request.query;
    const executions = ExecutionStore.list(workflowId);

    return executions.map((exec) => ({
      id: exec.id,
      workflowId: exec.workflowId,
      workflowName: exec.workflowName,
      status: exec.status,
      mode: exec.mode,
      startTime: exec.startTime.toISOString(),
      endTime: exec.endTime?.toISOString(),
      errorCount: exec.errors.length,
    }));
  });

  // Get execution details
  app.get<{ Params: { id: string } }>('/api/executions/:id', async (request, reply) => {
    const { id } = request.params;
    const execution = ExecutionStore.get(id);

    if (!execution) {
      return reply.status(404).send({ error: 'Execution not found' });
    }

    return {
      id: execution.id,
      workflowId: execution.workflowId,
      workflowName: execution.workflowName,
      status: execution.status,
      mode: execution.mode,
      startTime: execution.startTime.toISOString(),
      endTime: execution.endTime?.toISOString(),
      errors: execution.errors.map((e) => ({
        nodeName: e.nodeName,
        error: e.error,
        timestamp: e.timestamp.toISOString(),
      })),
      nodeData: execution.nodeData,
    };
  });

  // Delete an execution
  app.delete<{ Params: { id: string } }>('/api/executions/:id', async (request, reply) => {
    const { id } = request.params;
    const deleted = ExecutionStore.delete(id);

    if (!deleted) {
      return reply.status(404).send({ error: 'Execution not found' });
    }

    return { success: true };
  });

  // Clear all executions
  app.delete('/api/executions', async () => {
    ExecutionStore.clear();
    return { success: true };
  });

  // ============================================
  // Nodes API
  // ============================================

  // List all available node types
  app.get('/api/nodes', async () => {
    return NodeRegistry.getNodeInfoFull();
  });

  // Get schema for a specific node type
  app.get<{ Params: { type: string } }>('/api/nodes/:type', async (request, reply) => {
    const { type } = request.params;
    const info = NodeRegistry.getNodeTypeInfo(type);

    if (!info) {
      return reply.status(404).send({ error: `Node type "${type}" not found` });
    }

    return info;
  });
}
