import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import { BaseNode } from './BaseNode.js';

/**
 * Code node - execute arbitrary JavaScript
 * Input: items array (NodeData[])
 * Expected return: array of { json: {} } objects
 */
export class CodeNode extends BaseNode {
  readonly type = 'Code';
  readonly description = 'Execute custom JavaScript code';

  async execute(
    context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    const code = this.getParameter<string>(nodeDefinition, 'code', 'return items;');

    // Build context for code execution
    const $node: Record<string, { json: Record<string, unknown>; data: NodeData[] }> = {};
    for (const [nodeName, data] of context.nodeStates) {
      $node[nodeName] = {
        json: data[0]?.json || {},
        data,
      };
    }

    const items = inputData;
    const $input = inputData;
    const $json = inputData[0]?.json || {};
    const $env = process.env;
    const $execution = { id: context.executionId, mode: context.mode };

    // Helper functions available in code
    const helpers = {
      // Get item at index
      getItem: (index: number) => items[index],
      // Get all items
      getItems: () => items,
      // Create new item
      newItem: (json: Record<string, unknown>) => ({ json }),
      // Log (captured but not exposed for POC)
      log: (...args: unknown[]) => console.log('[Code Node]', ...args),
    };

    try {
      // Create function with context
      const fn = new Function(
        'items',
        '$input',
        '$json',
        '$node',
        '$env',
        '$execution',
        'helpers',
        `
        const { getItem, getItems, newItem, log } = helpers;
        ${code}
        `
      );

      const result = await fn(items, $input, $json, $node, $env, $execution, helpers);

      // Validate and normalize result
      const output = this.normalizeOutput(result);
      return this.output(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Code execution failed: ${message}`);
    }
  }

  private normalizeOutput(result: unknown): NodeData[] {
    if (!result) {
      return [];
    }

    if (!Array.isArray(result)) {
      // Single object - wrap in array
      if (typeof result === 'object' && result !== null) {
        if ('json' in result) {
          return [result as NodeData];
        }
        return [{ json: result as Record<string, unknown> }];
      }
      return [{ json: { value: result } }];
    }

    // Array - ensure each item has json property
    return result.map((item) => {
      if (item && typeof item === 'object' && 'json' in item) {
        return item as NodeData;
      }
      if (item && typeof item === 'object') {
        return { json: item as Record<string, unknown> };
      }
      return { json: { value: item } };
    });
  }
}
