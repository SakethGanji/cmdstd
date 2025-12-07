import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { NO_OUTPUT_SIGNAL } from '../engine/types.js';
import { BaseNode } from './BaseNode.js';

/**
 * Merge node - combine data from multiple branches
 * Modes:
 * - append: Concatenate all inputs
 * - waitForAll: Wait for all inputs, output as separate arrays
 * - keepMatches: Only keep items that match on a key field
 */
export class MergeNode extends BaseNode {
  readonly type = 'Merge';
  readonly description = 'Combine data from multiple workflow branches';
  // Dynamic input count - determined at runtime from connections
  // Set to Infinity to signal WorkflowRunner to count connections dynamically
  readonly inputCount = Infinity;

  static readonly nodeDescription: INodeTypeDescription = {
    name: 'Merge',
    displayName: 'Merge',
    icon: 'fa:compress-arrows-alt',
    description: 'Combine data from multiple workflow branches',
    group: ['flow'],

    inputs: 'dynamic', // Multiple inputs determined by connections
    inputStrategy: {
      type: 'dynamicFromConnections',
      minInputs: 2,
    },
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main',
        schema: {
          type: 'unknown',
          description: 'Combined data from all inputs (shape depends on merge mode)',
          passthrough: true,
        },
      },
    ],

    properties: [
      {
        displayName: 'Mode',
        name: 'mode', // ← matches getParameter('mode')
        type: 'options',
        default: 'append',
        options: [
          { name: 'Append', value: 'append', description: 'Concatenate all inputs' },
          { name: 'Wait For All', value: 'waitForAll', description: 'Wait for all inputs, output as arrays' },
          { name: 'Keep Matches', value: 'keepMatches', description: 'Only keep items matching on a field' },
          { name: 'Combine Pairs', value: 'combinePairs', description: 'Zip inputs pairwise' },
        ],
      },
      {
        displayName: 'Match Field',
        name: 'matchField', // ← matches getParameter('matchField')
        type: 'string',
        default: 'id',
        placeholder: 'id',
        description: 'Field to match items on (for Keep Matches mode)',
        displayOptions: {
          show: { mode: ['keepMatches'] },
        },
      },
    ],
  };

  async execute(
    context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    _inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    const mode = this.getParameter<string>(nodeDefinition, 'mode', 'append');
    const matchField = this.getParameter<string>(nodeDefinition, 'matchField', 'id');

    // Get all pending inputs for this node
    const nodeKey = Array.from(context.pendingInputs.keys()).find((k) =>
      k.startsWith(nodeDefinition.name + ':')
    );

    if (!nodeKey) {
      return this.output([]);
    }

    const pendingMap = context.pendingInputs.get(nodeKey);
    if (!pendingMap) {
      return this.output([]);
    }

    // Collect all inputs, filtering out NO_OUTPUT signals
    const allInputs: NodeData[][] = [];
    for (const [, data] of pendingMap) {
      if (data !== NO_OUTPUT_SIGNAL && Array.isArray(data) && data.length > 0) {
        allInputs.push(data);
      }
    }

    if (allInputs.length === 0) {
      return this.output([]);
    }

    let result: NodeData[];

    switch (mode) {
      case 'append':
        // Simple concatenation
        result = allInputs.flat();
        break;

      case 'waitForAll':
        // Combine into single item with arrays
        result = [
          {
            json: {
              inputs: allInputs.map((input) => input.map((item) => item.json)),
            },
          },
        ];
        break;

      case 'keepMatches': {
        // Only keep items that exist in all inputs (by matchField)
        if (allInputs.length < 2) {
          result = allInputs[0] || [];
          break;
        }

        const firstInput = allInputs[0];
        const otherInputs = allInputs.slice(1);

        result = firstInput.filter((item) => {
          const itemValue = this.getNestedValue(item.json, matchField);
          return otherInputs.every((input) =>
            input.some(
              (otherItem) =>
                this.getNestedValue(otherItem.json, matchField) === itemValue
            )
          );
        });
        break;
      }

      case 'combinePairs': {
        // Combine items pairwise (zip)
        const maxLength = Math.max(...allInputs.map((arr) => arr.length));
        result = [];
        for (let i = 0; i < maxLength; i++) {
          const combined: Record<string, unknown> = {};
          allInputs.forEach((input, inputIndex) => {
            if (input[i]) {
              combined[`input${inputIndex}`] = input[i].json;
            }
          });
          result.push({ json: combined });
        }
        break;
      }

      default:
        result = allInputs.flat();
    }

    // Clear pending inputs
    context.pendingInputs.delete(nodeKey);

    return this.output(result);
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}
