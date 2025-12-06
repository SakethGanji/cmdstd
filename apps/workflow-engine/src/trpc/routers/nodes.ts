import { z } from 'zod';
import { router, publicProcedure } from '../index.js';
import { NodeRegistry } from '../../engine/NodeRegistry.js';
import { TRPCError } from '@trpc/server';

export const nodesRouter = router({
  // List all available node types with full schema definitions
  list: publicProcedure.query(() => {
    return NodeRegistry.getNodeInfoFull();
  }),

  // Get schema for a specific node type
  get: publicProcedure
    .input(z.object({ type: z.string() }))
    .query(({ input }) => {
      const info = NodeRegistry.getNodeTypeInfo(input.type);

      if (!info) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Node type "${input.type}" not found`,
        });
      }

      return info;
    }),
});
