import Fastify from 'fastify';
import { workflowRoutes } from './routes/workflows.js';
import { executionRoutes } from './routes/executions.js';

const app = Fastify({
  logger: true,
});

// Register routes
app.register(workflowRoutes);
app.register(executionRoutes);

// Health check
app.get('/health', async () => ({ status: 'ok' }));

const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Workflow engine running on http://localhost:3000');
    console.log('');
    console.log('Available endpoints:');
    console.log('  GET  /health              - Health check');
    console.log('  GET  /nodes               - List all node types');
    console.log('');
    console.log('  POST /workflows           - Create workflow');
    console.log('  GET  /workflows           - List workflows');
    console.log('  GET  /workflows/:id       - Get workflow');
    console.log('  PUT  /workflows/:id       - Update workflow');
    console.log('  DEL  /workflows/:id       - Delete workflow');
    console.log('  PUT  /workflows/:id/active - Toggle active state');
    console.log('');
    console.log('  POST /workflows/run       - Run workflow (ad-hoc)');
    console.log('  POST /workflows/:id/run   - Run saved workflow');
    console.log('');
    console.log('  *    /webhook/:id         - Webhook trigger (GET/POST/PUT/DEL)');
    console.log('');
    console.log('  GET  /executions          - List executions');
    console.log('  GET  /executions/:id      - Get execution details');
    console.log('  DEL  /executions/:id      - Delete execution');
    console.log('  DEL  /executions          - Clear all executions');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
