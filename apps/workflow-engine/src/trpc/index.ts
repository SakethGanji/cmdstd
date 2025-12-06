import { initTRPC } from '@trpc/server';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Context passed to all tRPC procedures
export interface Context {
  req: FastifyRequest;
  res: FastifyReply;
}

export function createContext({ req, res }: { req: FastifyRequest; res: FastifyReply }): Context {
  return { req, res };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
