import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import { BaseNode } from './BaseNode.js';

export class WebhookNode extends BaseNode {
  readonly type = 'Webhook';
  readonly description = 'Triggers workflow from HTTP webhook requests';

  async execute(
    _context: ExecutionContext,
    _nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    return this.output(inputData.length > 0 ? inputData : [{ json: {} }]);
  }
}
