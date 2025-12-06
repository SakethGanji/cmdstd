import type { FastifyInstance } from 'fastify';
import { ExecutionStore } from '../storage/ExecutionStore.js';

export async function executionRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /executions - List all executions
   */
  app.get('/executions', async (request) => {
    const { workflowId } = request.query as { workflowId?: string };
    const executions = ExecutionStore.list(workflowId);

    return {
      executions: executions.map((exec) => ({
        id: exec.id,
        workflowId: exec.workflowId,
        workflowName: exec.workflowName,
        status: exec.status,
        mode: exec.mode,
        startTime: exec.startTime.toISOString(),
        endTime: exec.endTime?.toISOString(),
        errorCount: exec.errors.length,
      })),
    };
  });

  /**
   * GET /executions/:id - Get execution details with node data
   */
  app.get('/executions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const execution = ExecutionStore.get(id);

    if (!execution) {
      return reply.status(404).send({
        status: 'error',
        error: 'Execution not found',
      });
    }

    return {
      execution: {
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
      },
    };
  });

  /**
   * DELETE /executions/:id - Delete an execution record
   */
  app.delete('/executions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = ExecutionStore.delete(id);

    if (!deleted) {
      return reply.status(404).send({
        status: 'error',
        error: 'Execution not found',
      });
    }

    return { status: 'success' };
  });

  /**
   * DELETE /executions - Clear all execution history
   */
  app.delete('/executions', async () => {
    ExecutionStore.clear();
    return { status: 'success' };
  });
}
