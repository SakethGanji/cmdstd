import { z } from 'zod';
import { router, publicProcedure } from '../index.js';
import { ExecutionStore } from '../../storage/ExecutionStore.js';
import { TRPCError } from '@trpc/server';

export const executionsRouter = router({
  // List all executions
  list: publicProcedure
    .input(z.object({ workflowId: z.string().optional() }).optional())
    .query(({ input }) => {
      const executions = ExecutionStore.list(input?.workflowId);

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
    }),

  // Get execution details
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const execution = ExecutionStore.get(input.id);

      if (!execution) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Execution not found' });
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
    }),

  // Delete an execution
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const deleted = ExecutionStore.delete(input.id);

      if (!deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Execution not found' });
      }

      return { success: true };
    }),

  // Clear all executions
  clear: publicProcedure.mutation(() => {
    ExecutionStore.clear();
    return { success: true };
  }),
});
