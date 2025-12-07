import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';

export class WebhookNode extends BaseNode {
  readonly type = 'Webhook';
  readonly description = 'Triggers workflow from HTTP webhook requests';

  static readonly nodeDescription: INodeTypeDescription = {
    name: 'Webhook',
    displayName: 'Webhook',
    icon: 'fa:bolt',
    description: 'Triggers workflow from HTTP webhook requests',
    group: ['trigger'],
    inputs: [], // Trigger node - no inputs
    outputs: [{ name: 'main', displayName: 'Output', type: 'main' }],

    properties: [
      {
        displayName: 'HTTP Method',
        name: 'httpMethod',
        type: 'options',
        default: 'POST',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'DELETE', value: 'DELETE' },
        ],
        description: 'HTTP method to accept',
      },
      {
        displayName: 'Path',
        name: 'path',
        type: 'string',
        default: '',
        placeholder: 'webhook-path',
        description: 'Webhook path (e.g., /webhook/{path})',
      },
      {
        displayName: 'Response Mode',
        name: 'responseMode',
        type: 'options',
        default: 'onReceived',
        options: [
          { name: 'On Received', value: 'onReceived', description: 'Respond immediately' },
          { name: 'Last Node', value: 'lastNode', description: 'Respond with last node output' },
        ],
      },
    ],
  };

  async execute(
    _context: ExecutionContext,
    _nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    return this.output(inputData.length > 0 ? inputData : [{ json: {} }]);
  }
}
