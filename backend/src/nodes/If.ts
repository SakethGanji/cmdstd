import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import { BaseNode } from './BaseNode.js';

/**
 * Simple If node with true/false outputs
 * Simpler alternative to Switch for binary decisions
 */
export class IfNode extends BaseNode {
  readonly type = 'If';
  readonly description = 'Route items based on a condition (true/false outputs)';

  async execute(
    _context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    const field = this.getParameter<string>(nodeDefinition, 'field', '');
    const operation = this.getParameter<string>(nodeDefinition, 'operation', 'isTrue');
    const value = nodeDefinition.parameters['value'];

    const trueOutput: NodeData[] = [];
    const falseOutput: NodeData[] = [];

    for (const item of inputData) {
      const fieldValue = this.getNestedValue(item.json, field);
      const result = this.evaluate(fieldValue, operation, value);

      if (result) {
        trueOutput.push(item);
      } else {
        falseOutput.push(item);
      }
    }

    return this.outputs({
      true: trueOutput.length > 0 ? trueOutput : null,
      false: falseOutput.length > 0 ? falseOutput : null,
    });
  }

  private evaluate(fieldValue: unknown, operation: string, compareValue: unknown): boolean {
    switch (operation) {
      case 'equals':
        return fieldValue === compareValue;
      case 'notEquals':
        return fieldValue !== compareValue;
      case 'contains':
        return String(fieldValue).includes(String(compareValue));
      case 'notContains':
        return !String(fieldValue).includes(String(compareValue));
      case 'gt':
        return Number(fieldValue) > Number(compareValue);
      case 'gte':
        return Number(fieldValue) >= Number(compareValue);
      case 'lt':
        return Number(fieldValue) < Number(compareValue);
      case 'lte':
        return Number(fieldValue) <= Number(compareValue);
      case 'isEmpty':
        return fieldValue === null || fieldValue === undefined || fieldValue === '';
      case 'isNotEmpty':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
      case 'isTrue':
        return fieldValue === true || fieldValue === 'true' || fieldValue === 1;
      case 'isFalse':
        return fieldValue === false || fieldValue === 'false' || fieldValue === 0;
      case 'regex':
        try {
          return new RegExp(String(compareValue)).test(String(fieldValue));
        } catch {
          return false;
        }
      default:
        return Boolean(fieldValue);
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    if (!path) return obj;
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}
