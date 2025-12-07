/**
 * Shared AI Tools Registry
 *
 * This module provides a central registry of tools that can be used by any AI node.
 * Tools are defined once here and can be referenced by name in agent nodes.
 */

/**
 * Gemini function declaration format
 */
export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * A tool that can be used by AI agents
 */
export interface Tool {
  /** Tool declaration for the LLM (describes what the tool does) */
  declaration: ToolDeclaration;
  /** Function that actually executes the tool */
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Registry of all available tools
 */
const toolRegistry = new Map<string, Tool>();

/**
 * Register a new tool
 */
export function registerTool(tool: Tool): void {
  toolRegistry.set(tool.declaration.name, tool);
}

/**
 * Get a tool by name
 */
export function getTool(name: string): Tool | undefined {
  return toolRegistry.get(name);
}

/**
 * Get all registered tool names
 */
export function listTools(): string[] {
  return Array.from(toolRegistry.keys());
}

/**
 * Get tool declarations for specified tool names
 */
export function getToolDeclarations(names: string[]): ToolDeclaration[] {
  return names
    .map((name) => toolRegistry.get(name)?.declaration)
    .filter((d): d is ToolDeclaration => d !== undefined);
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ success: true; result: unknown } | { success: false; error: string }> {
  const tool = toolRegistry.get(name);
  if (!tool) {
    return { success: false, error: `Unknown tool: ${name}` };
  }

  try {
    const result = await tool.execute(args);
    return { success: true, result };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

// ============================================
// Built-in Tools
// ============================================

/**
 * HTTP Request Tool - Make API calls
 */
registerTool({
  declaration: {
    name: 'http_request',
    description:
      'Make an HTTP request to fetch data from an API. Use this to get external information.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to request',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE'],
          description: 'HTTP method (default: GET)',
        },
        body: {
          type: 'object',
          description: 'Request body for POST/PUT requests',
        },
        headers: {
          type: 'object',
          description: 'Additional headers to send',
        },
      },
      required: ['url'],
    },
  },
  execute: async (args) => {
    const {
      url,
      method = 'GET',
      body,
      headers = {},
    } = args as {
      url: string;
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    };

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get('content-type');
    let data: unknown;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      status: response.status,
      data,
    };
  },
});

/**
 * Calculate Tool - Math expressions
 */
registerTool({
  declaration: {
    name: 'calculate',
    description:
      'Perform mathematical calculations. Supports basic arithmetic and common math functions.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description:
            'Math expression to evaluate (e.g., "2 + 2", "Math.sqrt(16)", "10 * 5 / 2")',
        },
      },
      required: ['expression'],
    },
  },
  execute: async (args) => {
    const { expression } = args as { expression: string };

    try {
      const mathFuncs = {
        sqrt: Math.sqrt,
        pow: Math.pow,
        abs: Math.abs,
        round: Math.round,
        floor: Math.floor,
        ceil: Math.ceil,
        min: Math.min,
        max: Math.max,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        log: Math.log,
        exp: Math.exp,
        PI: Math.PI,
        E: Math.E,
      };

      // Replace Math.* with just the function name
      const cleanExpr = expression.replace(
        /Math\.(sqrt|pow|abs|round|floor|ceil|min|max|sin|cos|tan|log|exp|PI|E)/g,
        '$1'
      );

      // Safe evaluation with only math functions
      const fn = new Function(...Object.keys(mathFuncs), `return ${cleanExpr}`);
      const result = fn(...Object.values(mathFuncs));

      return { result, expression };
    } catch (error) {
      // Fallback: only allow numbers and basic operators
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
      const fn = new Function(`return ${sanitized}`);
      return { result: fn(), expression: sanitized };
    }
  },
});

/**
 * Get Current Time Tool
 */
registerTool({
  declaration: {
    name: 'get_current_time',
    description: 'Get the current date and time',
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'Timezone (e.g., "UTC", "America/New_York")',
        },
      },
    },
  },
  execute: async (args) => {
    const { timezone = 'UTC' } = args as { timezone?: string };

    const now = new Date();
    let formatted: string;

    try {
      formatted = now.toLocaleString('en-US', {
        timeZone: timezone,
        dateStyle: 'full',
        timeStyle: 'long',
      });
    } catch {
      // Fallback if timezone is invalid
      formatted = now.toLocaleString('en-US', {
        timeZone: 'UTC',
        dateStyle: 'full',
        timeStyle: 'long',
      });
    }

    return {
      iso: now.toISOString(),
      formatted,
      timezone,
      timestamp: now.getTime(),
    };
  },
});

/**
 * JSON Transform Tool - Extract/transform data
 */
registerTool({
  declaration: {
    name: 'json_transform',
    description:
      'Transform or extract data from JSON. Use this to parse, filter, or restructure data.',
    parameters: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description: 'The JSON data to transform',
        },
        path: {
          type: 'string',
          description: 'Dot notation path to extract (e.g., "users.0.name")',
        },
      },
      required: ['data'],
    },
  },
  execute: async (args) => {
    const { data, path } = args as { data: unknown; path?: string };

    if (!path) {
      return { result: data };
    }

    // Navigate the path
    const parts = path.split('.');
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return { result: null, error: `Path not found: ${path}` };
      }

      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return { result: null, error: `Cannot access ${part} on non-object` };
      }
    }

    return { result: current };
  },
});

/**
 * Get tool info for UI display
 */
export function getToolsInfo(): Array<{
  name: string;
  description: string;
}> {
  return Array.from(toolRegistry.values()).map((tool) => ({
    name: tool.declaration.name,
    description: tool.declaration.description,
  }));
}
