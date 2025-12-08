import type { FastifyInstance } from 'fastify';
import { WorkflowStore } from '../storage/WorkflowStore.js';
import { WorkflowRunner } from '../engine/WorkflowRunner.js';
import { ExecutionStore } from '../storage/ExecutionStore.js';
import { workflowValidator } from '../engine/WorkflowValidator.js';
import type { ExecutionEvent, NodeData } from '../engine/types.js';
import type { Workflow } from '../schemas/workflow.js';

const runner = new WorkflowRunner();

/**
 * SSE routes for real-time workflow execution streaming
 */
export async function executionStreamRoutes(fastify: FastifyInstance) {
  /**
   * Stream execution of a saved workflow
   * GET /execution-stream/:workflowId
   */
  fastify.get<{ Params: { workflowId: string } }>(
    '/execution-stream/:workflowId',
    async (request, reply) => {
      const { workflowId } = request.params;

      const stored = WorkflowStore.get(workflowId);
      if (!stored) {
        return reply.status(404).send({ error: 'Workflow not found' });
      }

      await streamWorkflowExecution(reply, stored.workflow, stored.id, stored.name);
    }
  );

  /**
   * Stream execution of an ad-hoc workflow (POST with workflow definition)
   * POST /execution-stream/adhoc
   */
  fastify.post<{ Body: Workflow }>(
    '/execution-stream/adhoc',
    async (request, reply) => {
      const workflow = request.body;

      // Validate workflow
      const validationResult = workflowValidator.validate(workflow);
      if (!validationResult.valid) {
        const errorMessages = validationResult.errors.map((e) => e.message).join('; ');
        return reply.status(400).send({ error: `Invalid workflow: ${errorMessages}` });
      }

      await streamWorkflowExecution(reply, workflow, workflow.id || 'adhoc', workflow.name);
    }
  );
}

/**
 * Helper to stream workflow execution via SSE
 */
async function streamWorkflowExecution(
  reply: any,
  workflow: Workflow,
  workflowId: string,
  workflowName: string
) {
  // Set SSE headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });

  // Helper to send SSE event
  const sendEvent = (event: ExecutionEvent) => {
    const data = JSON.stringify({
      ...event,
      timestamp: event.timestamp.toISOString(),
      // Convert NodeData[] to serializable format
      data: event.data?.map((d) => ({
        json: d.json,
        // Omit binary data from SSE stream
      })),
    });
    reply.raw.write(`data: ${data}\n\n`);
  };

  // Find start node
  const startNode = runner.findStartNode(workflow);
  if (!startNode) {
    sendEvent({
      type: 'execution:error',
      executionId: 'error',
      timestamp: new Date(),
      error: 'No start node found in workflow',
    });
    reply.raw.end();
    return;
  }

  // Initial data for manual execution
  const initialData: NodeData[] = [
    {
      json: {
        triggeredAt: new Date().toISOString(),
        mode: 'manual',
      },
    },
  ];

  try {
    // Run workflow with event callback
    const context = await runner.run(
      workflow,
      startNode.name,
      initialData,
      'manual',
      (event) => {
        sendEvent(event);
      }
    );

    // Store execution record
    ExecutionStore.complete(context, workflowId, workflowName);

    // Send final data summary
    const nodeData: Record<string, unknown> = {};
    for (const [nodeName, data] of context.nodeStates) {
      nodeData[nodeName] = data;
    }

    // Send completion event with full data
    reply.raw.write(
      `data: ${JSON.stringify({
        type: 'execution:result',
        executionId: context.executionId,
        timestamp: new Date().toISOString(),
        status: context.errors.length > 0 ? 'failed' : 'success',
        data: nodeData,
        errors: context.errors.map((e) => ({
          ...e,
          timestamp: e.timestamp.toISOString(),
        })),
      })}\n\n`
    );
  } catch (error) {
    sendEvent({
      type: 'execution:error',
      executionId: 'error',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // End the stream
  reply.raw.end();
}
