import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';
import ivm from 'isolated-vm';

/**
 * Code node - execute arbitrary JavaScript in a sandboxed environment
 * Uses isolated-vm for V8 isolate-based sandboxing (more secure than vm2)
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
    outputs: [{ name: 'main', displayName: 'Output', type: 'main' }],

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

Note: Code runs in a V8 isolate with a 5 second timeout.
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

    // Create isolated VM
    const isolate = new ivm.Isolate({ memoryLimit: 128 }); // 128MB memory limit

    try {
      const vmContext = await isolate.createContext();
      const jail = vmContext.global;

      // Set global reference
      await jail.set('global', jail.derefInto());

      // Serialize data to JSON strings for safe transfer (avoids non-transferable value errors)
      const serializedData = {
        items: JSON.stringify(items),
        $input: JSON.stringify($input),
        $json: JSON.stringify($json),
        $node: JSON.stringify($node),
        $execution: JSON.stringify($execution),
      };

      // Inject serialized data
      await jail.set('__itemsJson', serializedData.items);
      await jail.set('__$inputJson', serializedData.$input);
      await jail.set('__$jsonJson', serializedData.$json);
      await jail.set('__$nodeJson', serializedData.$node);
      await jail.set('__$executionJson', serializedData.$execution);

      // Inject log function that captures to our logs array
      await jail.set('__log', new ivm.Reference((...args: unknown[]) => {
        logs.push(args);
        console.log('[Code Node]', ...args);
      }));

      // Bootstrap script to set up the environment - parse JSON inside isolate
      const bootstrap = `
        const items = JSON.parse(__itemsJson);
        const $input = JSON.parse(__$inputJson);
        const $json = JSON.parse(__$jsonJson);
        const $node = JSON.parse(__$nodeJson);
        const $execution = JSON.parse(__$executionJson);

        function getItem(index) { return items[index]; }
        function getItems() { return items; }
        function newItem(json) { return { json }; }
        function log(...args) {
          __log.applySync(undefined, args.map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
          ));
        }

        const console = {
          log: log,
          warn: log,
          error: log,
          info: log
        };
      `;

      // Compile and run bootstrap
      const bootstrapScript = await isolate.compileScript(bootstrap);
      await bootstrapScript.run(vmContext);

      // Wrap user code - serialize result back to JSON for safe transfer out
      const wrappedCode = `
        (async () => {
          const __result = await (async () => {
            ${code}
          })();
          return JSON.stringify(__result);
        })()
      `;

      // Compile user code
      const userScript = await isolate.compileScript(wrappedCode);

      // Run with timeout (5 seconds)
      const resultJson = await userScript.run(vmContext, {
        timeout: 5000,
        promise: true,
      });

      // Parse result from JSON
      let result: unknown;
      if (typeof resultJson === 'string') {
        result = JSON.parse(resultJson);
      } else {
        result = resultJson;
      }

      // Validate and normalize result
      const output = this.normalizeOutput(result);
      return this.output(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Code execution failed: ${message}`);
    } finally {
      // Always dispose the isolate to free memory
      isolate.dispose();
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
