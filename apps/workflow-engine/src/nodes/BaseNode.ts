import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  INode,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';

/**
 * Abstract base class for all workflow nodes
 *
 * Nodes should define a static `nodeDescription` property for schema-driven UI:
 *
 * @example
 * export class HttpRequestNode extends BaseNode {
 *   static readonly nodeDescription: INodeTypeDescription = {
 *     name: 'HttpRequest',
 *     displayName: 'HTTP Request',
 *     icon: 'fa:globe',
 *     properties: [...]
 *   };
 *
 *   readonly type = 'HttpRequest';
 *   readonly description = '...';
 *
 *   async execute(...) { ... }
 * }
 */
export abstract class BaseNode implements INode {
  /**
   * Static node description for UI schema generation
   * CRITICAL: Property names in schema must match getParameter() calls in execute()
   */
  static readonly nodeDescription?: INodeTypeDescription;

  abstract readonly type: string;
  abstract readonly description: string;
  readonly inputCount?: number;

  abstract execute(
    context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult>;

  protected getParameter<T>(
    nodeDefinition: NodeDefinition,
    key: string,
    defaultValue?: T
  ): T {
    const value = nodeDefinition.parameters[key];
    if (value === undefined) {
      if (defaultValue === undefined) {
        throw new Error(
          `Missing required parameter "${key}" in node "${nodeDefinition.name}"`
        );
      }
      return defaultValue;
    }
    return value as T;
  }

  protected hasParameter(nodeDefinition: NodeDefinition, key: string): boolean {
    return nodeDefinition.parameters[key] !== undefined;
  }

  /**
   * Helper to create single-output result
   */
  protected output(data: NodeData[]): NodeExecutionResult {
    return { outputs: { main: data } };
  }

  /**
   * Helper to create multi-output result
   */
  protected outputs(outputs: Record<string, NodeData[] | null>): NodeExecutionResult {
    return { outputs };
  }

  /**
   * Helper to create NodeData array from plain objects
   */
  protected toNodeData(data: Record<string, unknown>[]): NodeData[] {
    return data.map((json) => ({ json }));
  }
}
