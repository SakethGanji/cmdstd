import { z } from 'zod';

export const NodeDataSchema = z.object({
  json: z.record(z.unknown()),
  binary: z.record(z.any()).optional(),
});

export const NodeParametersSchema = z.record(z.unknown());

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const NodeDefinitionSchema = z.object({
  name: z.string().min(1, 'Node name is required'),
  type: z.string().min(1, 'Node type is required'),
  parameters: NodeParametersSchema.default({}),
  // UI position on canvas
  position: PositionSchema.optional(),
  // Error handling
  continueOnFail: z.boolean().default(false),
  retryOnFail: z.number().int().min(0).max(10).default(0),
  retryDelay: z.number().int().min(0).default(1000),
  // Data pinning for development
  pinnedData: z.array(NodeDataSchema).optional(),
});

export const ConnectionSchema = z.object({
  sourceNode: z.string(),
  sourceOutput: z.string().default('main'),
  targetNode: z.string(),
  targetInput: z.string().default('main'),
});

export const WorkflowSchema = z.object({
  id: z.string().optional(),
  name: z.string().default('Untitled Workflow'),
  nodes: z.array(NodeDefinitionSchema).min(1, 'At least one node is required'),
  connections: z.array(ConnectionSchema).default([]),
});

export type NodeData = z.infer<typeof NodeDataSchema>;
export type NodeParameters = z.infer<typeof NodeParametersSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type NodeDefinition = z.infer<typeof NodeDefinitionSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
