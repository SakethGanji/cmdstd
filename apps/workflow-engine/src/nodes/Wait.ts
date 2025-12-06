import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';

/**
 * Wait node - pause execution for a specified duration
 * For POC: only time-based mode (no webhook resume)
 */
export class WaitNode extends BaseNode {
  readonly type = 'Wait';
  readonly description = 'Pause workflow execution for a specified time';

  static readonly nodeDescription: INodeTypeDescription = {
    name: 'Wait',
    displayName: 'Wait',
    icon: 'fa:clock',
    description: 'Pause workflow execution for a specified time',
    group: ['flow'],
    outputs: [{ name: 'main', displayName: 'Output' }],

    properties: [
      {
        displayName: 'Duration',
        name: 'duration', // ← matches getParameter('duration')
        type: 'number',
        default: 1000,
        typeOptions: { minValue: 0 },
        description: 'How long to wait',
      },
      {
        displayName: 'Unit',
        name: 'unit', // ← matches getParameter('unit')
        type: 'options',
        default: 'ms',
        options: [
          { name: 'Milliseconds', value: 'ms' },
          { name: 'Seconds', value: 'seconds' },
          { name: 'Minutes', value: 'minutes' },
          { name: 'Hours', value: 'hours' },
        ],
        description: 'Time unit for the duration',
      },
    ],
  };

  async execute(
    _context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    const duration = this.getParameter<number>(nodeDefinition, 'duration', 1000);
    const unit = this.getParameter<string>(nodeDefinition, 'unit', 'ms');

    let waitMs = duration;
    switch (unit) {
      case 'seconds':
      case 's':
        waitMs = duration * 1000;
        break;
      case 'minutes':
      case 'm':
        waitMs = duration * 60 * 1000;
        break;
      case 'hours':
      case 'h':
        waitMs = duration * 60 * 60 * 1000;
        break;
    }

    // Cap at 5 minutes for POC to prevent long-running requests
    waitMs = Math.min(waitMs, 5 * 60 * 1000);

    await this.sleep(waitMs);

    return this.output(inputData);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
