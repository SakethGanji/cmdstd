import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import { BaseNode } from './BaseNode.js';

export class StartNode extends BaseNode {
  readonly type = 'Start';
  readonly description = 'Entry point for manual workflow execution';

  async execute(
    _context: ExecutionContext,
    _nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    return this.output(inputData.length > 0 ? inputData : [{ json: {} }]);
  }
}
