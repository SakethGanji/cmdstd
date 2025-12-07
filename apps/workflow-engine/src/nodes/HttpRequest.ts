import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';

/**
 * Header item structure for collection type
 */
interface HeaderItem {
  name: string;
  value: string;
}

export class HttpRequestNode extends BaseNode {
  readonly type = 'HttpRequest';
  readonly description = 'Makes HTTP requests to external APIs';

  /**
   * Schema for UI form generation
   * CRITICAL: Property names must match getParameter() calls in execute()
   */
  static readonly nodeDescription: INodeTypeDescription = {
    name: 'HttpRequest',
    displayName: 'HTTP Request',
    icon: 'fa:globe',
    description: 'Makes HTTP requests to external APIs',
    group: ['transform'],
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' }],
    outputs: [{ name: 'main', displayName: 'Response', type: 'main' }],

    properties: [
      {
        displayName: 'Method',
        name: 'method', // ← matches getParameter('method')
        type: 'options',
        default: 'GET',
        required: true,
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'PATCH', value: 'PATCH' },
          { name: 'DELETE', value: 'DELETE' },
          { name: 'HEAD', value: 'HEAD' },
        ],
      },
      {
        displayName: 'URL',
        name: 'url', // ← matches getParameter('url')
        type: 'string',
        default: '',
        required: true,
        placeholder: 'https://api.example.com/endpoint',
        description:
          'The URL to make the request to. Supports expressions: {{ $json.url }}',
      },
      {
        displayName: 'Headers',
        name: 'headers', // ← matches getParameter('headers')
        type: 'collection',
        default: [],
        description: 'HTTP headers to send with the request',
        typeOptions: { multipleValues: true },
        properties: [
          {
            displayName: 'Header Name',
            name: 'name',
            type: 'string',
            default: '',
            placeholder: 'Content-Type',
          },
          {
            displayName: 'Header Value',
            name: 'value',
            type: 'string',
            default: '',
            placeholder: 'application/json',
          },
        ],
      },
      {
        displayName: 'Body',
        name: 'body', // ← matches getParameter('body')
        type: 'json',
        default: '',
        description: 'Request body (for POST, PUT, PATCH)',
        typeOptions: { language: 'json', rows: 10 },
        displayOptions: {
          show: { method: ['POST', 'PUT', 'PATCH'] },
        },
      },
      {
        displayName: 'Response Type',
        name: 'responseType', // ← matches getParameter('responseType')
        type: 'options',
        default: 'json',
        options: [
          { name: 'JSON', value: 'json', description: 'Parse response as JSON' },
          { name: 'Text', value: 'text', description: 'Return raw text' },
          { name: 'Binary', value: 'binary', description: 'Return binary data' },
        ],
      },
    ],
  };

  async execute(
    _context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    // Parameters MUST use same names as schema properties
    const url = this.getParameter<string>(nodeDefinition, 'url');
    const method = this.getParameter<string>(nodeDefinition, 'method', 'GET');
    const responseType = this.getParameter<string>(
      nodeDefinition,
      'responseType',
      'json'
    );

    // Headers can come in two formats for backward compatibility:
    // 1. Collection format (new): Array<{name, value}>
    // 2. Object format (legacy): Record<string, string>
    const headersParam = this.getParameter<HeaderItem[] | Record<string, string>>(
      nodeDefinition,
      'headers',
      []
    );

    // Convert collection format to Record<string, string>
    const headers: Record<string, string> = {};
    if (Array.isArray(headersParam)) {
      // New collection format: [{name: 'Content-Type', value: 'application/json'}]
      for (const h of headersParam) {
        if (h.name) {
          headers[h.name] = h.value;
        }
      }
    } else {
      // Legacy object format: {'Content-Type': 'application/json'}
      Object.assign(headers, headersParam);
    }

    // Body only used for methods that support it
    const body = ['POST', 'PUT', 'PATCH'].includes(method)
      ? nodeDefinition.parameters['body']
      : undefined;

    const results: NodeData[] = [];

    for (const _item of inputData.length > 0 ? inputData : [{ json: {} }]) {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (body && method !== 'GET' && method !== 'HEAD') {
        fetchOptions.body =
          typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);

      let responseData: unknown;
      if (responseType === 'text') {
        responseData = await response.text();
      } else if (responseType === 'binary') {
        const buffer = await response.arrayBuffer();
        responseData = { _binary: true, size: buffer.byteLength };
      } else {
        responseData = await response.json().catch(() => ({}));
      }

      results.push({
        json: {
          statusCode: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseData,
        },
      });
    }

    return this.output(results);
  }
}
