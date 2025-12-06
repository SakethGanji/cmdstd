import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import { BaseNode } from './BaseNode.js';

interface SplitState {
  items: NodeData[];
  batchIndex: number;
  totalItems: number;
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
