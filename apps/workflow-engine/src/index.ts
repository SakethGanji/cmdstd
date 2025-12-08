import Fastify from 'fastify';
import {
  fastifyTRPCPlugin,
  type FastifyTRPCPluginOptions,
} from '@trpc/server/adapters/fastify';
import { workflowRoutes } from './routes/workflows.js';
import { executionStreamRoutes } from './routes/execution-stream.js';
import { appRouter, type AppRouter } from './trpc/router.js';
import { createContext } from './trpc/index.js';

const app = Fastify({
  logger: true,
});

// Register tRPC (main API for frontend)
app.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext,
    onError({ path, error }) {
      console.error(`tRPC error on ${path}:`, error);
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
});

// REST routes for webhooks only (external callers need REST)
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
