import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';

/**
 * ReadFile Node
 *
 * Simple pass-through node that outputs a file path.
 * Designed for future extensibility (S3, URLs, etc).
 * The actual file reading is done by downstream nodes (e.g., PandasExplore).
 */
export class ReadFileNode extends BaseNode {
  readonly type = 'ReadFile';
  readonly description = 'Provides a file path for downstream processing';

  static readonly nodeDescription: INodeTypeDescription = {
    name: 'ReadFile',
    displayName: 'Read File',
    icon: 'fa:file',
    description: 'Provides a file path for downstream processing',
    group: ['input'],
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' }],
    outputs: [
      {
        name: 'main',
        displayName: 'File Path',
        type: 'main',
        schema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Absolute path to the file' },
          },
        },
      },
    ],

    properties: [
      {
        displayName: 'File Path',
        name: 'filePath',
        type: 'string',
        default: '',
        required: true,
        placeholder: '/path/to/data.csv',
        description: 'Absolute path to the file. Supports expressions: {{ $json.path }}',
      },
    ],
  };

  async execute(
    _context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    const filePath = this.getParameter<string>(nodeDefinition, 'filePath');

    // Process each input item (or single item if no input)
    const results: NodeData[] = [];
    for (const _item of inputData.length > 0 ? inputData : [{ json: {} }]) {
      results.push({
        json: {
          filePath,
        },
      });
    }

    return this.output(results);
  }
}
