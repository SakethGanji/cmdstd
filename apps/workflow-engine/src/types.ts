/**
 * Public type exports for workflow-engine
 *
 * This file re-exports types that consumers (like workflow-studio) need.
 */

// tRPC router type
export type { AppRouter } from './trpc/router.js';

// Node schema types for UI generation
export type {
  INodeTypeDescription,
  INodeTypeInfo,
  INodeProperty,
  INodePropertyOption,
  INodePropertyTypeOptions,
  IDisplayOptions,
  INodeInputDefinition,
  INodeOutputDefinition,
  IInputStrategy,
  IOutputStrategy,
  IOutputSchema,
  IOutputSchemaProperty,
  NodePropertyType,
  NodePortType,
} from './engine/nodeSchema.js';

// Execution types
export type {
  NodeData,
  NodeExecutionResult,
  ExecutionContext,
  ExecutionEvent,
  ExecutionEventType,
  INode,
} from './engine/types.js';
