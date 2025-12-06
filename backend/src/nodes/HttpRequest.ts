import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import { BaseNode } from './BaseNode.js';

export class HttpRequestNode extends BaseNode {
  readonly type = 'HttpRequest';
  readonly description = 'Makes HTTP requests to external APIs';

  async execute(
    _context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    const url = this.getParameter<string>(nodeDefinition, 'url');
    const method = this.getParameter<string>(nodeDefinition, 'method', 'GET');
    const headers = this.getParameter<Record<string, string>>(
      nodeDefinition,
      'headers',
      {}
    );
    const body = nodeDefinition.parameters['body'];
    const responseType = this.getParameter<string>(
      nodeDefinition,
      'responseType',
      'json'
    );

    const results: NodeData[] = [];

    for (const item of inputData.length > 0 ? inputData : [{ json: {} }]) {
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
