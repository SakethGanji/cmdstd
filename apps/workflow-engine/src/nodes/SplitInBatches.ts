import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';

interface SplitState {
  items: NodeData[];
  batchIndex: number;
  totalItems: number;
  [key: string]: unknown; // Index signature for compatibility with Record<string, unknown>
}

/**
 * SplitInBatches node - process arrays in chunks with looping
 *
 * Outputs:
 * - loop: Current batch (connects to nodes that process the batch)
 * - done: Final output when all batches processed
 *
 * The "loop" output should connect to processing nodes, which eventually
 * connect back to this SplitInBatches node to continue with next batch.
 */
export class SplitInBatchesNode extends BaseNode {
  readonly type = 'SplitInBatches';
  readonly description = 'Process items in batches with looping';

  static readonly nodeDescription: INodeTypeDescription = {
    name: 'SplitInBatches',
    displayName: 'Split In Batches',
    icon: 'fa:th-large',
    description: 'Process items in batches with looping',
    group: ['flow'],

    outputs: [
      { name: 'loop', displayName: 'Loop' },
      { name: 'done', displayName: 'Done' },
    ],

    properties: [
      {
        displayName: 'Batch Size',
        name: 'batchSize', // ← matches getParameter('batchSize')
        type: 'number',
        default: 10,
        typeOptions: { minValue: 1 },
        description: 'Number of items to process in each batch',
      },
    ],
  };

  async execute(
    context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    const batchSize = this.getParameter<number>(nodeDefinition, 'batchSize', 10);
    const stateKey = nodeDefinition.name;

    // Get or initialize state
    let state = context.nodeInternalState.get(stateKey) as SplitState | undefined;

    if (!state) {
      // First run - initialize with all input items
      state = {
        items: inputData,
        batchIndex: 0,
        totalItems: inputData.length,
      };
      context.nodeInternalState.set(stateKey, state);
    }

    const startIdx = state.batchIndex;
    const endIdx = Math.min(startIdx + batchSize, state.items.length);
    const batch = state.items.slice(startIdx, endIdx);

    if (batch.length === 0) {
      // No more items - we're done
      context.nodeInternalState.delete(stateKey);
      return this.outputs({
        loop: null,
        done: [
          {
            json: {
              totalProcessed: state.totalItems,
              batchesProcessed: Math.ceil(state.totalItems / batchSize),
            },
          },
        ],
      });
    }

    // Update state for next iteration
    state.batchIndex = endIdx;
    context.nodeInternalState.set(stateKey, state);

    // Return current batch on "loop" output
    return this.outputs({
      loop: batch,
      done: null,
    });
  }
}
