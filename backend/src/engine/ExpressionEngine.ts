import type { NodeData } from './types.js';

export interface ExpressionContext {
  $json: Record<string, unknown>;
  $input: NodeData[];
  $node: Record<string, { json: Record<string, unknown>; data: NodeData[] }>;
  $env: Record<string, string | undefined>;
  $execution: { id: string; mode: string };
  $itemIndex: number;
}

export class ExpressionEngine {
  /**
   * Resolve all {{ }} expressions in a value
   * Handles strings, objects, and arrays recursively
   */
  resolve<T>(value: T, context: ExpressionContext): T {
    if (typeof value === 'string') {
      return this.resolveString(value, context) as T;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolve(item, context)) as T;
    }

    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.resolve(val, context);
      }
      return result as T;
    }

    return value;
  }

  /**
   * Resolve expressions in a string
   * Supports: {{ $json.field }}, {{ $node["Name"].json.field }}, {{ $json.name.toUpperCase() }}
   */
  private resolveString(str: string, context: ExpressionContext): unknown {
    // Check if entire string is a single expression (return typed value)
    const trimmed = str.trim();
    if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
      const innerExpressions = this.extractExpressions(trimmed);
      if (innerExpressions.length === 1 && trimmed === `{{${innerExpressions[0]}}`) {
        // Single expression - return actual type
        return this.evaluate(innerExpressions[0], context);
      }
    }

    // Multiple expressions or mixed content - return string
    return this.replaceExpressions(str, context);
  }

  /**
   * Extract all expressions from a string, handling nested braces
   */
  private extractExpressions(str: string): string[] {
    const expressions: string[] = [];
    let i = 0;

    while (i < str.length) {
      if (str[i] === '{' && str[i + 1] === '{') {
        // Find matching }}
        let depth = 0;
        let start = i + 2;
        let j = start;

        while (j < str.length) {
          if (str[j] === '{') {
            depth++;
          } else if (str[j] === '}') {
            if (depth === 0 && str[j + 1] === '}') {
              expressions.push(str.slice(start, j).trim());
              i = j + 2;
              break;
            }
            depth = Math.max(0, depth - 1);
          }
          j++;
        }

        if (j >= str.length) {
          // Unclosed expression, skip
          i++;
        }
      } else {
        i++;
      }
    }

    return expressions;
  }

  /**
   * Replace all {{ }} expressions in a string with evaluated values
   */
  private replaceExpressions(str: string, context: ExpressionContext): string {
    let result = '';
    let i = 0;

    while (i < str.length) {
      if (str[i] === '{' && str[i + 1] === '{') {
        // Find matching }}
        let depth = 0;
        let start = i + 2;
        let j = start;

        while (j < str.length) {
          if (str[j] === '{') {
            depth++;
          } else if (str[j] === '}') {
            if (depth === 0 && str[j + 1] === '}') {
              const expr = str.slice(start, j).trim();
              const value = this.evaluate(expr, context);
              result += this.stringify(value);
              i = j + 2;
              break;
            }
            depth = Math.max(0, depth - 1);
          }
          j++;
        }

        if (j >= str.length) {
          // Unclosed expression, keep as-is
          result += str[i];
          i++;
        }
      } else {
        result += str[i];
        i++;
      }
    }

    return result;
  }

  /**
   * Evaluate a single expression using Function constructor
   */
  private evaluate(expression: string, context: ExpressionContext): unknown {
    try {
      // Build context variables
      const contextKeys = Object.keys(context);
      const contextValues = Object.values(context);

      // Create function with context variables as parameters
      const func = new Function(...contextKeys, `return ${expression};`);

      return func(...contextValues);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return `[Expression Error: ${message}]`;
    }
  }

  /**
   * Convert value to string for interpolation
   */
  private stringify(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Create expression context from execution state
   */
  static createContext(
    currentData: NodeData[],
    nodeStates: Map<string, NodeData[]>,
    executionId: string,
    itemIndex: number = 0
  ): ExpressionContext {
    const currentItem = currentData[itemIndex] || { json: {} };

    // Build $node object for accessing any previous node
    const $node: ExpressionContext['$node'] = {};
    for (const [nodeName, data] of nodeStates) {
      $node[nodeName] = {
        json: data[0]?.json || {},
        data,
      };
    }

    return {
      $json: currentItem.json as Record<string, unknown>,
      $input: currentData,
      $node,
      $env: process.env as Record<string, string | undefined>,
      $execution: { id: executionId, mode: 'manual' },
      $itemIndex: itemIndex,
    };
  }
}

// Singleton instance
export const expressionEngine = new ExpressionEngine();
