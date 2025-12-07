import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';

/**
 * Cron trigger node - triggers workflow on schedule
 * For POC: Simple interval-based triggering
 * The actual scheduling is handled by the CronManager, not this node
 */
export class CronNode extends BaseNode {
  readonly type = 'Cron';
  readonly description = 'Trigger workflow on a schedule';

  static readonly nodeDescription: INodeTypeDescription = {
    name: 'Cron',
    displayName: 'Cron',
    icon: 'fa:calendar-alt',
    description: 'Trigger workflow on a schedule',
    group: ['trigger'],
    inputs: [], // Trigger node - no inputs
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main',
        schema: {
          type: 'object',
          properties: {
            triggeredAt: { type: 'string', description: 'ISO timestamp when triggered' },
            executionId: { type: 'string', description: 'Unique execution ID' },
            mode: { type: 'string', description: 'Trigger mode (cron)' },
            schedule: { type: 'string', description: 'Schedule description' },
          },
        },
      },
    ],

    properties: [
      {
        displayName: 'Mode',
        name: 'mode',
        type: 'options',
        default: 'interval',
        options: [
          { name: 'Interval', value: 'interval', description: 'Run at fixed intervals' },
          { name: 'Cron Expression', value: 'cron', description: 'Use cron expression' },
        ],
      },
      {
        displayName: 'Interval Value',
        name: 'intervalValue',
        type: 'number',
        default: 5,
        typeOptions: { minValue: 1 },
        displayOptions: {
          show: { mode: ['interval'] },
        },
      },
      {
        displayName: 'Interval Unit',
        name: 'intervalUnit',
        type: 'options',
        default: 'minutes',
        options: [
          { name: 'Seconds', value: 'seconds' },
          { name: 'Minutes', value: 'minutes' },
          { name: 'Hours', value: 'hours' },
          { name: 'Days', value: 'days' },
        ],
        displayOptions: {
          show: { mode: ['interval'] },
        },
      },
      {
        displayName: 'Cron Expression',
        name: 'cron', // ← matches getParameter('cron')
        type: 'string',
        default: '0 * * * *',
        placeholder: '0 * * * *',
        description: 'Cron expression (minute hour day month weekday)',
        displayOptions: {
          show: { mode: ['cron'] },
        },
      },
    ],
  };

  async execute(
    context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    // Cron node passes through trigger data with timing info
    const cronExpression = this.getParameter<string>(nodeDefinition, 'cron', '');
    const interval = this.getParameter<{ value: number; unit: string }>(
      nodeDefinition,
      'interval',
      { value: 5, unit: 'minutes' }
    );

    const triggerData: NodeData = {
      json: {
        triggeredAt: context.startTime.toISOString(),
        executionId: context.executionId,
        mode: 'cron',
        schedule: cronExpression || `every ${interval.value} ${interval.unit}`,
      },
    };

    return this.output(inputData.length > 0 ? inputData : [triggerData]);
  }
}

/**
 * Simple cron scheduler for POC
 * In production, use a proper job scheduler like node-cron or bull
 */
export class CronManager {
  private jobs = new Map<string, NodeJS.Timeout>();

  /**
   * Schedule a workflow to run on interval
   */
  schedule(
    workflowId: string,
    intervalMs: number,
    callback: () => Promise<void>
  ): void {
    this.cancel(workflowId); // Cancel existing if any

    const timer = setInterval(async () => {
      try {
        await callback();
      } catch (error) {
        console.error(`Cron job failed for workflow ${workflowId}:`, error);
      }
    }, intervalMs);

    this.jobs.set(workflowId, timer);
  }

  /**
   * Cancel a scheduled workflow
   */
  cancel(workflowId: string): void {
    const timer = this.jobs.get(workflowId);
    if (timer) {
      clearInterval(timer);
      this.jobs.delete(workflowId);
    }
  }

  /**
   * Cancel all scheduled workflows
   */
  cancelAll(): void {
    for (const timer of this.jobs.values()) {
      clearInterval(timer);
    }
    this.jobs.clear();
  }

  /**
   * Get list of scheduled workflow IDs
   */
  list(): string[] {
    return Array.from(this.jobs.keys());
  }

  /**
   * Parse interval config to milliseconds
   */
  static parseInterval(interval: { value: number; unit: string }): number {
    const { value, unit } = interval;
    switch (unit) {
      case 'seconds':
        return value * 1000;
      case 'minutes':
        return value * 60 * 1000;
      case 'hours':
        return value * 60 * 60 * 1000;
      case 'days':
        return value * 24 * 60 * 60 * 1000;
      default:
        return value * 60 * 1000; // Default to minutes
    }
  }
}

// Singleton instance
export const cronManager = new CronManager();
