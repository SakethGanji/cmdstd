import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';

interface Rule {
  output: number;
  field: string;
  operation: string;
  value: unknown;
}

export class SwitchNode extends BaseNode {
  readonly type = 'Switch';
  readonly description = 'Route items to different outputs based on conditions';

  /**
   * Schema for UI form generation
   * CRITICAL: Dynamic outputs - frontend uses outputStrategy to calculate output count
   */
  static readonly nodeDescription: INodeTypeDescription = {
    name: 'Switch',
    displayName: 'Switch',
    icon: 'fa:random',
    description: 'Route items to different outputs based on conditions',
    group: ['flow'],

    // Dynamic outputs based on rules
    outputs: 'dynamic',
    outputStrategy: {
      type: 'dynamicFromCollection',
      collectionName: 'rules',
      addFallback: true,
    },

    properties: [
      {
        displayName: 'Mode',
        name: 'mode', // ← matches getParameter('mode')
        type: 'options',
        default: 'rules',
        options: [
          { name: 'Rules', value: 'rules', description: 'Evaluate conditions against each item' },
          { name: 'Expression', value: 'expression', description: 'Use expression to determine output' },
        ],
      },
      {
        displayName: 'Rules',
        name: 'rules', // ← matches getParameter('rules')
        type: 'collection',
        default: [],
        typeOptions: { multipleValues: true },
        displayOptions: {
          show: { mode: ['rules'] },
        },
        properties: [
          {
            displayName: 'Output Index',
            name: 'output',
            type: 'number',
            default: 0,
            typeOptions: { minValue: 0 },
            description: 'Which output to route matching items to',
          },
          {
            displayName: 'Field',
            name: 'field',
            type: 'string',
            default: '',
            placeholder: 'status',
            description: 'Field path to evaluate (supports dot notation: user.name)',
          },
          {
            displayName: 'Operation',
            name: 'operation',
            type: 'options',
            default: 'equals',
            options: [
              { name: 'Equals', value: 'equals' },
              { name: 'Not Equals', value: 'notEquals' },
              { name: 'Contains', value: 'contains' },
              { name: 'Not Contains', value: 'notContains' },
              { name: 'Starts With', value: 'startsWith' },
              { name: 'Ends With', value: 'endsWith' },
              { name: 'Greater Than', value: 'gt' },
              { name: 'Greater or Equal', value: 'gte' },
              { name: 'Less Than', value: 'lt' },
              { name: 'Less or Equal', value: 'lte' },
              { name: 'Is Empty', value: 'isEmpty' },
              { name: 'Is Not Empty', value: 'isNotEmpty' },
              { name: 'Regex Match', value: 'regex' },
              { name: 'Is True', value: 'isTrue' },
              { name: 'Is False', value: 'isFalse' },
            ],
          },
          {
            displayName: 'Value',
            name: 'value',
            type: 'string',
            default: '',
            description: 'Value to compare against. Supports expressions.',
            displayOptions: {
              hide: { operation: ['isEmpty', 'isNotEmpty', 'isTrue', 'isFalse'] },
            },
          },
        ],
      },
      {
        displayName: 'Expression',
        name: 'expression', // ← matches getParameter('expression')
        type: 'string',
        default: '0',
        description: 'Expression that evaluates to output index (0-based)',
        displayOptions: {
          show: { mode: ['expression'] },
        },
      },
      {
        displayName: 'Fallback Output',
        name: 'fallbackOutput', // ← matches getParameter('fallbackOutput')
        type: 'number',
        default: 0,
        typeOptions: { minValue: 0 },
        description: 'Output index when no rules match',
      },
    ],
  };

  async execute(
    _context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    const mode = this.getParameter<string>(nodeDefinition, 'mode', 'rules');
    const rules = this.getParameter<Rule[]>(nodeDefinition, 'rules', []);
    const fallbackOutput = this.getParameter<number>(nodeDefinition, 'fallbackOutput', 0);

    // Initialize output buckets
    const outputs: Record<string, NodeData[]> = {};
    const maxOutput = Math.max(fallbackOutput, ...rules.map((r) => r.output));

    for (let i = 0; i <= maxOutput; i++) {
      outputs[`output${i}`] = [];
    }

    if (mode === 'expression') {
      // Expression mode: evaluate expression to get output index
      const expression = this.getParameter<string>(nodeDefinition, 'expression', '0');
      for (const item of inputData) {
        try {
          const outputIndex = Number(expression) || fallbackOutput;
          const key = `output${outputIndex}`;
          if (outputs[key]) {
            outputs[key].push(item);
          } else {
            outputs[`output${fallbackOutput}`].push(item);
          }
        } catch {
          outputs[`output${fallbackOutput}`].push(item);
        }
      }
    } else {
      // Rules mode: evaluate each rule against each item
      for (const item of inputData) {
        let matched = false;

        for (const rule of rules) {
          if (this.evaluateRule(rule, item.json)) {
            const key = `output${rule.output}`;
            outputs[key].push(item);
            matched = true;
            break; // First match wins
          }
        }

        if (!matched) {
          outputs[`output${fallbackOutput}`].push(item);
        }
      }
    }

    // Convert empty arrays to null for NO_OUTPUT signal
    const result: Record<string, NodeData[] | null> = {};
    for (const [key, data] of Object.entries(outputs)) {
      result[key] = data.length > 0 ? data : null;
    }

    return this.outputs(result);
  }

  private evaluateRule(rule: Rule, json: Record<string, unknown>): boolean {
    const fieldValue = this.getNestedValue(json, rule.field);
    const ruleValue = rule.value;

    switch (rule.operation) {
      case 'equals':
        return fieldValue === ruleValue;
      case 'notEquals':
        return fieldValue !== ruleValue;
      case 'contains':
        return String(fieldValue).includes(String(ruleValue));
      case 'notContains':
        return !String(fieldValue).includes(String(ruleValue));
      case 'startsWith':
        return String(fieldValue).startsWith(String(ruleValue));
      case 'endsWith':
        return String(fieldValue).endsWith(String(ruleValue));
      case 'gt':
        return Number(fieldValue) > Number(ruleValue);
      case 'gte':
        return Number(fieldValue) >= Number(ruleValue);
      case 'lt':
        return Number(fieldValue) < Number(ruleValue);
      case 'lte':
        return Number(fieldValue) <= Number(ruleValue);
      case 'isEmpty':
        return fieldValue === null || fieldValue === undefined || fieldValue === '';
      case 'isNotEmpty':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
      case 'regex':
        try {
          const regex = new RegExp(String(ruleValue));
          return regex.test(String(fieldValue));
        } catch {
          return false;
        }
      case 'isTrue':
        return fieldValue === true || fieldValue === 'true' || fieldValue === 1;
      case 'isFalse':
        return fieldValue === false || fieldValue === 'false' || fieldValue === 0;
      default:
        return false;
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}
