import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';
import { VM } from 'vm2';

/**
 * Code node - execute arbitrary JavaScript in a sandboxed environment
 * Uses vm2 for sandboxed execution
 *
 * Input: items array (NodeData[])
 * Expected return: array of { json: {} } objects
 */
export class CodeNode extends BaseNode {
  readonly type = 'Code';
  readonly description = 'Execute custom JavaScript code';

  /**
   * Schema for UI form generation
   */
  static readonly nodeDescription: INodeTypeDescription = {
    name: 'Code',
    displayName: 'Code',
    icon: 'fa:code',
    description: 'Execute custom JavaScript code',
    group: ['transform'],
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main',
        schema: {
          type: 'unknown',
          description: 'User-defined output from JavaScript code execution',
        },
      },
    ],

    properties: [
      {
        displayName: 'JavaScript Code',
        name: 'code', // ← matches getParameter('code')
        type: 'json',
        default: 'return items;',
        typeOptions: {
          language: 'javascript',
          rows: 15,
        },
        description: `Available variables:
- items: Input data array
- $json: First input item's json
- $input: All input items
- $node: Access data from previous nodes (e.g., $node["NodeName"].json)
- $execution: { id, mode }

Helper functions:
- getItem(index): Get item at index
- newItem(json): Create new { json } item
- log(...): Console log (captured)

Return an array of { json: {} } objects.

Note: Code runs in a sandbox with a 5 second timeout.
Process, require, and file system access are not available.`,
      },
    ],
  };

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
    const $execution = { id: context.executionId, mode: context.mode };

    // Captured logs
    const logs: unknown[][] = [];

    // Create sandboxed VM with vm2
    const vm = new VM({
      timeout: 5000, // 5 second timeout
      sandbox: {
        items,
        $input,
        $json,
        $node,
        $execution,
        getItem: (index: number) => items[index],
        getItems: () => items,
        newItem: (json: Record<string, unknown>) => ({ json }),
        log: (...args: unknown[]) => {
          logs.push(args);
          console.log('[Code Node]', ...args);
        },
        console: {
          log: (...args: unknown[]) => {
            logs.push(args);
            console.log('[Code Node]', ...args);
          },
          warn: (...args: unknown[]) => {
            logs.push(args);
            console.log('[Code Node]', ...args);
          },
          error: (...args: unknown[]) => {
            logs.push(args);
            console.log('[Code Node]', ...args);
          },
          info: (...args: unknown[]) => {
            logs.push(args);
            console.log('[Code Node]', ...args);
          },
        },
      },
    });

    try {
      // Wrap user code to handle async execution
      const wrappedCode = `
        (async () => {
          ${code}
        })()
      `;

      // Run the code
      const result = await vm.run(wrappedCode);

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
