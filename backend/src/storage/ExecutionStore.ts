import type { ExecutionRecord, ExecutionContext, NodeData } from '../engine/types.js';

/**
 * In-memory execution history storage for POC
 */
class ExecutionStoreClass {
  private executions = new Map<string, ExecutionRecord>();
  private maxRecords = 100; // Keep last 100 executions

  /**
   * Create a new execution record when workflow starts
   */
  start(
    executionId: string,
    workflowId: string,
    workflowName: string,
    mode: 'manual' | 'webhook' | 'cron'
  ): ExecutionRecord {
    const record: ExecutionRecord = {
      id: executionId,
      workflowId,
      workflowName,
      status: 'running',
      mode,
      startTime: new Date(),
      nodeData: {},
      errors: [],
    };
    this.executions.set(executionId, record);
    this.cleanup();
    return record;
  }

  /**
   * Update execution with final state
   */
  complete(context: ExecutionContext, workflowId: string, workflowName: string): ExecutionRecord {
    const record = this.executions.get(context.executionId) || {
      id: context.executionId,
      workflowId,
      workflowName,
      status: 'running' as const,
      mode: context.mode,
      startTime: context.startTime,
      nodeData: {},
      errors: [],
    };

    // Convert nodeStates Map to plain object
    const nodeData: Record<string, NodeData[]> = {};
    for (const [nodeName, data] of context.nodeStates) {
      nodeData[nodeName] = data;
    }

    record.status = context.errors.length > 0 ? 'failed' : 'success';
    record.endTime = new Date();
    record.nodeData = nodeData;
    record.errors = context.errors;

    this.executions.set(context.executionId, record);
    return record;
  }

  /**
   * Mark execution as failed
   */
  fail(executionId: string, error: string): ExecutionRecord | undefined {
    const record = this.executions.get(executionId);
    if (!record) return undefined;

    record.status = 'failed';
    record.endTime = new Date();
    record.errors.push({ nodeName: '_system', error, timestamp: new Date() });
    return record;
  }

  get(id: string): ExecutionRecord | undefined {
    return this.executions.get(id);
  }

  list(workflowId?: string): ExecutionRecord[] {
    const all = Array.from(this.executions.values());
    const filtered = workflowId ? all.filter((e) => e.workflowId === workflowId) : all;
    return filtered.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  delete(id: string): boolean {
    return this.executions.delete(id);
  }

  clear(): void {
    this.executions.clear();
  }

  private cleanup(): void {
    if (this.executions.size > this.maxRecords) {
      const sorted = Array.from(this.executions.entries()).sort(
        ([, a], [, b]) => a.startTime.getTime() - b.startTime.getTime()
      );
      const toDelete = sorted.slice(0, sorted.length - this.maxRecords);
      for (const [id] of toDelete) {
        this.executions.delete(id);
      }
    }
  }
}

export const ExecutionStore = new ExecutionStoreClass();
