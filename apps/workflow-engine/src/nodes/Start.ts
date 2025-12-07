import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';

export class StartNode extends BaseNode {
  readonly type = 'Start';
  readonly description = 'Entry point for manual workflow execution';

  static readonly nodeDescription: INodeTypeDescription = {
    name: 'Start',
    displayName: 'Start',
    icon: 'fa:play',
    description: 'Entry point for manual workflow execution',
    group: ['trigger'],
    inputs: [], // Trigger node - no inputs
    outputs: [{ name: 'main', displayName: 'Output', type: 'main' }],
    properties: [], // No configuration needed
  };

  async execute(
    _context: ExecutionContext,
    _nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    return this.output(inputData.length > 0 ? inputData : [{ json: {} }]);
  }
}
