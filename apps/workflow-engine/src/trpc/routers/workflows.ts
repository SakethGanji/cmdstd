import { z } from 'zod';
import { router, publicProcedure } from '../index.js';
import { WorkflowSchema, type Workflow } from '../../schemas/workflow.js';
import { WorkflowStore } from '../../storage/WorkflowStore.js';
import { WorkflowRunner } from '../../engine/WorkflowRunner.js';
import { ExecutionStore } from '../../storage/ExecutionStore.js';
import { workflowValidator } from '../../engine/WorkflowValidator.js';
import { TRPCError } from '@trpc/server';

const runner = new WorkflowRunner();

/**
 * Validate workflow and throw TRPCError if invalid
 */
function validateWorkflow(workflow: Workflow): void {
  const result = workflowValidator.validate(workflow);

  if (!result.valid) {
    const errorMessages = result.errors.map((e) => e.message).join('; ');
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid workflow: ${errorMessages}`,
    });
  }
}

export const workflowsRouter = router({
  // List all workflows
  list: publicProcedure.query(() => {
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
  }),

  // Get a single workflow by ID
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const stored = WorkflowStore.get(input.id);

      if (!stored) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
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
    }),

  // Create a new workflow
  create: publicProcedure
    .input(WorkflowSchema)
    .mutation(({ input }) => {
      validateWorkflow(input);
      const stored = WorkflowStore.create(input);

      return {
        id: stored.id,
        name: stored.name,
        active: stored.active,
        webhookUrl: `/webhook/${stored.id}`,
        createdAt: stored.createdAt.toISOString(),
      };
    }),

  // Update a workflow
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      workflow: WorkflowSchema,
    }))
    .mutation(({ input }) => {
      validateWorkflow(input.workflow);
      const updated = WorkflowStore.update(input.id, input.workflow);

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      }

      return {
        id: updated.id,
        name: updated.name,
        active: updated.active,
        updatedAt: updated.updatedAt.toISOString(),
      };
    }),

  // Delete a workflow
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const deleted = WorkflowStore.delete(input.id);

      if (!deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      }

      return { success: true };
    }),

  // Toggle active state
  setActive: publicProcedure
    .input(z.object({
      id: z.string(),
      active: z.boolean(),
    }))
    .mutation(({ input }) => {
      const updated = WorkflowStore.setActive(input.id, input.active);

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      }

      return {
        id: updated.id,
        active: updated.active,
      };
    }),

  // Run a saved workflow
  run: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const stored = WorkflowStore.get(input.id);

      if (!stored) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      }

      const startNode = runner.findStartNode(stored.workflow);
      if (!startNode) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No start node found in workflow' });
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
    }),

  // Run an ad-hoc workflow (without saving)
  runAdhoc: publicProcedure
    .input(WorkflowSchema)
    .mutation(async ({ input }) => {
      validateWorkflow(input);

      const startNode = runner.findStartNode(input);
      if (!startNode) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No start node found in workflow' });
      }

      const initialData = [
        {
          json: {
            triggeredAt: new Date().toISOString(),
            mode: 'manual',
          },
        },
      ];

      const context = await runner.run(input, startNode.name, initialData, 'manual');
      ExecutionStore.complete(context, input.id || 'adhoc', input.name);

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
    }),
});
