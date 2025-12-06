import { router } from './index.js';
import { workflowsRouter } from './routers/workflows.js';
import { executionsRouter } from './routers/executions.js';
import { nodesRouter } from './routers/nodes.js';

export const appRouter = router({
  workflows: workflowsRouter,
  executions: executionsRouter,
  nodes: nodesRouter,
});

// Export type for client
export type AppRouter = typeof appRouter;
