import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';

interface FieldDefinition {
  name: string;
  value: unknown;
}

/**
 * Set node - create, update, or delete fields on items
 */
export class SetNode extends BaseNode {
  readonly type = 'Set';
  readonly description = 'Set, rename, or delete fields on items';

  /**
   * Schema for UI form generation
   * CRITICAL: Mode switching shows/hides different field collections
   */
  static readonly nodeDescription: INodeTypeDescription = {
    name: 'Set',
    displayName: 'Set',
    icon: 'fa:edit',
    description: 'Set, rename, or delete fields on items',
    group: ['transform'],
    outputs: [{ name: 'main', displayName: 'Output' }],

    properties: [
      {
        displayName: 'Mode',
        name: 'mode', // ← matches getParameter('mode')
        type: 'options',
        default: 'manual',
        options: [
          { name: 'Manual', value: 'manual', description: 'Define fields individually' },
          { name: 'JSON', value: 'json', description: 'Merge a JSON object' },
        ],
      },
      {
        displayName: 'Fields to Set',
        name: 'fields', // ← matches getParameter('fields')
        type: 'collection',
        default: [],
        typeOptions: { multipleValues: true },
        displayOptions: {
          show: { mode: ['manual'] },
        },
        properties: [
          {
            displayName: 'Field Name',
            name: 'name',
            type: 'string',
            default: '',
            placeholder: 'fieldName',
            description: 'Supports dot notation for nested fields (e.g., user.name)',
          },
          {
            displayName: 'Value',
            name: 'value',
            type: 'string',
            default: '',
            description: 'Supports expressions: {{ $json.existingField }}',
          },
        ],
      },
      {
        displayName: 'JSON Data',
        name: 'jsonData', // ← matches getParameter('jsonData')
        type: 'json',
        default: '{}',
        typeOptions: { language: 'json', rows: 8 },
        description: 'JSON object to merge into each item',
        displayOptions: {
          show: { mode: ['json'] },
        },
      },
      {
        displayName: 'Keep Only Set',
        name: 'keepOnlySet', // ← matches getParameter('keepOnlySet')
        type: 'boolean',
        default: false,
        description: 'If true, removes all existing fields and only keeps new ones',
      },
      {
        displayName: 'Fields to Delete',
        name: 'deleteFields', // ← matches getParameter('deleteFields')
        type: 'collection',
        default: [],
        typeOptions: { multipleValues: true },
        properties: [
          {
            displayName: 'Field Path',
            name: 'path',
            type: 'string',
            default: '',
            placeholder: 'user.tempData',
            description: 'Path to field to delete (supports dot notation)',
          },
        ],
      },
      {
        displayName: 'Fields to Rename',
        name: 'renameFields', // ← matches getParameter('renameFields')
        type: 'collection',
        default: [],
        typeOptions: { multipleValues: true },
        properties: [
          {
            displayName: 'From',
            name: 'from',
            type: 'string',
            default: '',
            placeholder: 'oldFieldName',
          },
          {
            displayName: 'To',
            name: 'to',
            type: 'string',
            default: '',
            placeholder: 'newFieldName',
          },
        ],
      },
    ],
  };

  async execute(
    _context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    const mode = this.getParameter<string>(nodeDefinition, 'mode', 'manual');
    const keepOnlySet = this.getParameter<boolean>(nodeDefinition, 'keepOnlySet', false);

    const results: NodeData[] = [];

    for (const item of inputData.length > 0 ? inputData : [{ json: {} }]) {
      let newJson: Record<string, unknown>;

      if (keepOnlySet) {
        newJson = {};
      } else {
        newJson = { ...item.json };
      }

      if (mode === 'manual') {
        // Manual mode: explicit field definitions
        const fields = this.getParameter<FieldDefinition[]>(nodeDefinition, 'fields', []);
        for (const field of fields) {
          if (field.name) {
            this.setNestedValue(newJson, field.name, field.value);
          }
        }
      } else if (mode === 'json') {
        // JSON mode: merge entire JSON object
        const jsonData = this.getParameter<Record<string, unknown>>(
          nodeDefinition,
          'jsonData',
          {}
        );
        Object.assign(newJson, jsonData);
      }

      // Handle field deletions (collection format: [{path: 'fieldName'}])
      const deleteFields = this.getParameter<Array<{ path: string }> | string[]>(
        nodeDefinition,
        'deleteFields',
        []
      );
      for (const field of deleteFields) {
        const fieldPath = typeof field === 'string' ? field : field.path;
        if (fieldPath) {
          this.deleteNestedValue(newJson, fieldPath);
        }
      }

      // Handle field renames
      const renameFields = this.getParameter<Array<{ from: string; to: string }>>(
        nodeDefinition,
        'renameFields',
        []
      );
      for (const rename of renameFields) {
        const value = this.getNestedValue(newJson, rename.from);
        if (value !== undefined) {
          this.deleteNestedValue(newJson, rename.from);
          this.setNestedValue(newJson, rename.to, value);
        }
      }

      results.push({ json: newJson, binary: item.binary });
    }

    return this.output(results);
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }

  private deleteNestedValue(obj: Record<string, unknown>, path: string): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        return; // Path doesn't exist
      }
      current = current[key] as Record<string, unknown>;
    }

    delete current[keys[keys.length - 1]];
  }
}
