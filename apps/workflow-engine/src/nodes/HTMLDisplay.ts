import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';

/**
 * HTMLDisplay Node
 *
 * Pass-through node that ensures HTML content is marked for rendering.
 * Extracts HTML from a specified field and marks it with _renderAs: 'html'
 * for the frontend to render in an iframe.
 */
export class HTMLDisplayNode extends BaseNode {
  readonly type = 'HTMLDisplay';
  readonly description = 'Displays HTML content in the output panel';

  static readonly nodeDescription: INodeTypeDescription = {
    name: 'HTMLDisplay',
    displayName: 'HTML Display',
    icon: 'fa:code',
    description: 'Displays HTML content in an iframe in the output panel',
    group: ['output'],
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' }],
    outputs: [
      {
        name: 'main',
        displayName: 'HTML Output',
        type: 'main',
        schema: {
          type: 'object',
          properties: {
            html: { type: 'string', description: 'HTML content to display' },
            _renderAs: { type: 'string', description: 'Render hint (always "html")' },
          },
        },
      },
    ],

    properties: [
      {
        displayName: 'HTML Field',
        name: 'htmlField',
        type: 'string',
        default: 'html',
        description: 'Field name in input data containing the HTML content',
      },
    ],
  };

  async execute(
    _context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    const htmlField = this.getParameter<string>(nodeDefinition, 'htmlField', 'html');

    const results: NodeData[] = [];

    for (const item of inputData.length > 0 ? inputData : [{ json: {} }]) {
      const html = item.json[htmlField] as string;

      if (!html) {
        throw new Error(`Missing HTML content in field "${htmlField}". Make sure the upstream node provides this field.`);
      }

      results.push({
        json: {
          html,
          _renderAs: 'html',
        },
      });
    }

    return this.output(results);
  }
}
