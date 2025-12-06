import type { NodeData } from './types.js';
import { Parser } from 'expr-eval';

export interface ExpressionContext {
  $json: Record<string, unknown>;
  $input: NodeData[];
  $node: Record<string, { json: Record<string, unknown>; data: NodeData[] }>;
  $env: Record<string, string | undefined>;
  $execution: { id: string; mode: string };
  $itemIndex: number;
}

/**
 * Safe expression parser that doesn't use eval() or Function()
 * Uses expr-eval library with a whitelist of allowed functions
 */
export class ExpressionEngine {
  private parser: Parser;

  constructor() {
    this.parser = new Parser({
      allowMemberAccess: true,
    });

    // Add safe helper functions
    this.parser.functions.String = String;
    this.parser.functions.Number = Number;
    this.parser.functions.Boolean = Boolean;
    this.parser.functions.parseInt = parseInt;
    this.parser.functions.parseFloat = parseFloat;
    this.parser.functions.isNaN = isNaN;
    this.parser.functions.isFinite = isFinite;
    this.parser.functions.JSON_stringify = (v: unknown) => JSON.stringify(v);
    this.parser.functions.JSON_parse = (s: string) => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    };

    // String functions
    this.parser.functions.toLowerCase = (s: string) => String(s).toLowerCase();
    this.parser.functions.toUpperCase = (s: string) => String(s).toUpperCase();
    this.parser.functions.trim = (s: string) => String(s).trim();
    this.parser.functions.split = (s: string, sep: string) => String(s).split(sep);
    this.parser.functions.join = (arr: unknown[], sep: string) => arr.join(sep);
    this.parser.functions.includes = (s: string, search: string) => String(s).includes(search);
    this.parser.functions.replace = (s: string, search: string, replacement: string) =>
      String(s).replace(search, replacement);
    this.parser.functions.substring = (s: string, start: number, end?: number) =>
      String(s).substring(start, end);
    this.parser.functions.length = (s: string | unknown[]) =>
      Array.isArray(s) ? s.length : String(s).length;

    // Array functions
    this.parser.functions.first = (arr: unknown[]) => (Array.isArray(arr) ? arr[0] : arr);
    this.parser.functions.last = (arr: unknown[]) =>
      Array.isArray(arr) ? arr[arr.length - 1] : arr;
    this.parser.functions.at = (arr: unknown[], index: number) =>
      Array.isArray(arr) ? arr[index] : undefined;

    // Math is already included by expr-eval

    // Date functions
    this.parser.functions.now = () => Date.now();
    this.parser.functions.Date_now = () => new Date().toISOString();

    // Type checking
    this.parser.functions.typeof = (v: unknown) => typeof v;
    this.parser.functions.isArray = (v: unknown) => Array.isArray(v);
    this.parser.functions.isEmpty = (v: unknown) =>
      v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
  }

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
   * Supports: {{ $json.field }}, {{ $node["Name"].json.field }}
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
   * Evaluate a single expression safely using expr-eval
   */
  private evaluate(expression: string, context: ExpressionContext): unknown {
    try {
      // Transform n8n-style expressions to expr-eval compatible syntax
      // $node["NodeName"].json.field -> $node_NodeName_json.field
      let transformedExpr = expression;

      // Handle $node["NodeName"] syntax - transform to flat object access
      transformedExpr = transformedExpr.replace(
        /\$node\["([^"]+)"\]/g,
        (_, nodeName) => `$node_${this.sanitizeNodeName(nodeName)}`
      );

      // Build flat context for expr-eval (it doesn't handle nested objects well with string keys)
      const flatContext: Record<string, unknown> = {
        $json: context.$json,
        $input: context.$input,
        $env: context.$env,
        $execution: context.$execution,
        $itemIndex: context.$itemIndex,
      };

      // Flatten $node access
      for (const [nodeName, nodeData] of Object.entries(context.$node)) {
        flatContext[`$node_${this.sanitizeNodeName(nodeName)}`] = nodeData;
      }

      const parsed = this.parser.parse(transformedExpr);
      return parsed.evaluate(flatContext as Record<string, unknown> as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return `[Expression Error: ${message}]`;
    }
  }

  /**
   * Sanitize node name for use as variable name
   */
  private sanitizeNodeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
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
