import Fastify from 'fastify';
import { workflowRoutes } from './routes/workflows.js';
import { executionStreamRoutes } from './routes/execution-stream.js';
import { apiRoutes } from './routes/api.js';

const app = Fastify({
  logger: true,
});

// REST API routes (replaces tRPC)
app.register(apiRoutes);

// REST routes for webhooks (external callers)
app.register(workflowRoutes);

// SSE routes for real-time execution streaming
app.register(executionStreamRoutes);

// Health check
app.get('/health', async () => ({ status: 'ok' }));

const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Workflow engine running on http://localhost:3000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
