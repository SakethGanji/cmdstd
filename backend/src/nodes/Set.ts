import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
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

      // Handle field deletions
      const deleteFields = this.getParameter<string[]>(nodeDefinition, 'deleteFields', []);
      for (const fieldPath of deleteFields) {
        this.deleteNestedValue(newJson, fieldPath);
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
