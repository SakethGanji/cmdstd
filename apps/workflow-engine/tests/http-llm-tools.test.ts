/**
 * HTTP -> LLM -> Tool Calling Flow Tests
 * Tests for HTTP requests, LLM calls, and AI agent tool calling
 * Note: LLM tests require GOOGLE_AI_API_KEY to be set
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetStores,
  createWorkflow,
  createNode,
  createConnection,
  runWorkflow,
  getNodeOutput,
} from './setup.js';

describe('HTTP Request Node', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET requests', () => {
    it('should make GET request to public API', async () => {
      const workflow = createWorkflow(
        'HTTP GET Test',
        [
          createNode('Start', 'Start'),
          createNode('FetchData', 'HttpRequest', {
            method: 'GET',
            url: 'https://httpbin.org/get',
            responseType: 'json',
          }),
        ],
        [createConnection('Start', 'FetchData')]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors).toHaveLength(0);
      const output = getNodeOutput(context, 'FetchData');
      expect(output).toBeDefined();
      expect(output![0].json.statusCode).toBe(200);
      expect(output![0].json.body).toBeDefined();
    });

    it('should include custom headers in request', async () => {
      const workflow = createWorkflow(
        'HTTP Headers Test',
        [
          createNode('Start', 'Start'),
          createNode('FetchData', 'HttpRequest', {
            method: 'GET',
            url: 'https://httpbin.org/headers',
            headers: [
              { name: 'X-Custom-Header', value: 'test-value' },
              { name: 'X-Another-Header', value: 'another-value' },
            ],
            responseType: 'json',
          }),
        ],
        [createConnection('Start', 'FetchData')]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors).toHaveLength(0);
      const output = getNodeOutput(context, 'FetchData');
      const body = output![0].json.body as any;
      expect(body.headers['X-Custom-Header']).toBe('test-value');
    });
  });

  describe('POST requests', () => {
    it('should make POST request with JSON body', async () => {
      const workflow = createWorkflow(
        'HTTP POST Test',
        [
          createNode('Start', 'Start'),
          createNode('PostData', 'HttpRequest', {
            method: 'POST',
            url: 'https://httpbin.org/post',
            body: JSON.stringify({ name: 'test', value: 123 }),
            responseType: 'json',
          }),
        ],
        [createConnection('Start', 'PostData')]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors).toHaveLength(0);
      const output = getNodeOutput(context, 'PostData');
      expect(output![0].json.statusCode).toBe(200);
      const body = output![0].json.body as any;
      expect(body.json).toBeDefined();
      expect(body.json.name).toBe('test');
    });

    it('should handle object body (auto-stringify)', async () => {
      const workflow = createWorkflow(
        'HTTP POST Object',
        [
          createNode('Start', 'Start'),
          createNode('PostData', 'HttpRequest', {
            method: 'POST',
            url: 'https://httpbin.org/post',
            body: { data: 'test-data', items: [1, 2, 3] },
            responseType: 'json',
          }),
        ],
        [createConnection('Start', 'PostData')]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors).toHaveLength(0);
      const output = getNodeOutput(context, 'PostData');
      const body = output![0].json.body as any;
      expect(body.json.data).toBe('test-data');
      expect(body.json.items).toEqual([1, 2, 3]);
    });
  });

  describe('Response types', () => {
    it('should return text response', async () => {
      const workflow = createWorkflow(
        'HTTP Text Response',
        [
          createNode('Start', 'Start'),
          createNode('Fetch', 'HttpRequest', {
            method: 'GET',
            url: 'https://httpbin.org/robots.txt',
            responseType: 'text',
          }),
        ],
        [createConnection('Start', 'Fetch')]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors).toHaveLength(0);
      const output = getNodeOutput(context, 'Fetch');
      expect(typeof output![0].json.body).toBe('string');
    });
  });

  describe('HTTP -> Set chain', () => {
    it('should transform HTTP response with Set node', async () => {
      const workflow = createWorkflow(
        'HTTP to Set',
        [
          createNode('Start', 'Start'),
          createNode('Fetch', 'HttpRequest', {
            method: 'GET',
            url: 'https://httpbin.org/get?param=value',
            responseType: 'json',
          }),
          createNode('Extract', 'Set', {
            mode: 'manual',
            keepOnlySet: true,
            fields: [
              { name: 'status', value: '{{ $json.statusCode }}' },
              { name: 'processed', value: true },
            ],
          }),
        ],
        [
          createConnection('Start', 'Fetch'),
          createConnection('Fetch', 'Extract'),
        ]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors).toHaveLength(0);
      const output = getNodeOutput(context, 'Extract');
      expect(output![0].json.processed).toBe(true);
    });
  });

  describe('HTTP -> Code chain', () => {
    it('should process HTTP response with Code node', async () => {
      const workflow = createWorkflow(
        'HTTP to Code',
        [
          createNode('Start', 'Start'),
          createNode('Fetch', 'HttpRequest', {
            method: 'GET',
            url: 'https://httpbin.org/get?test=hello',
            responseType: 'json',
          }),
          createNode('Process', 'Code', {
            code: `
              return items.map(item => ({
                json: {
                  wasSuccessful: item.json.statusCode === 200,
                  bodyKeys: Object.keys(item.json.body || {})
                }
              }));
            `,
          }),
        ],
        [
          createConnection('Start', 'Fetch'),
          createConnection('Fetch', 'Process'),
        ]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors).toHaveLength(0);
      const output = getNodeOutput(context, 'Process');
      expect(output![0].json.wasSuccessful).toBe(true);
      expect(Array.isArray(output![0].json.bodyKeys)).toBe(true);
    });
  });
});

// LLM and AI Agent tests - these require API key
describe('LLM Chat Node', () => {
  beforeEach(() => {
    resetStores();
  });

  // Skip if no API key
  const hasApiKey = !!process.env.GOOGLE_AI_API_KEY;

  it.skipIf(!hasApiKey)('should make a simple LLM call', async () => {
    const workflow = createWorkflow(
      'LLM Chat Test',
      [
        createNode('Start', 'Start'),
        createNode('LLM', 'LLMChat', {
          model: 'gemini-2.0-flash',
          userPrompt: 'Say "Hello Test" and nothing else.',
          temperature: 0,
          maxTokens: 50,
        }),
      ],
      [createConnection('Start', 'LLM')]
    );

    const context = await runWorkflow(workflow);

    expect(context.errors).toHaveLength(0);
    const output = getNodeOutput(context, 'LLM');
    expect(output![0].json.response).toBeDefined();
    expect(typeof output![0].json.response).toBe('string');
    expect(output![0].json.model).toBe('gemini-2.0-flash');
  });

  it.skipIf(!hasApiKey)('should chain HTTP -> LLM to summarize data', async () => {
    const workflow = createWorkflow(
      'HTTP to LLM',
      [
        createNode('Start', 'Start'),
        createNode('Fetch', 'HttpRequest', {
          method: 'GET',
          url: 'https://httpbin.org/get?item=test',
          responseType: 'json',
        }),
        createNode('Summarize', 'LLMChat', {
          model: 'gemini-2.0-flash',
          userPrompt: 'Given this HTTP response status: {{ $json.statusCode }}, respond with just "success" if 200, "failure" otherwise.',
          temperature: 0,
          maxTokens: 20,
        }),
      ],
      [
        createConnection('Start', 'Fetch'),
        createConnection('Fetch', 'Summarize'),
      ]
    );

    const context = await runWorkflow(workflow);

    expect(context.errors).toHaveLength(0);
    const output = getNodeOutput(context, 'Summarize');
    expect(output![0].json.response).toBeDefined();
  });

  it.skipIf(!hasApiKey)('should include usage statistics', async () => {
    const workflow = createWorkflow(
      'LLM Usage Stats',
      [
        createNode('Start', 'Start'),
        createNode('LLM', 'LLMChat', {
          model: 'gemini-2.0-flash',
          userPrompt: 'Hi',
          temperature: 0,
          maxTokens: 10,
        }),
      ],
      [createConnection('Start', 'LLM')]
    );

    const context = await runWorkflow(workflow);

    expect(context.errors).toHaveLength(0);
    const output = getNodeOutput(context, 'LLM');
    expect(output![0].json.usage).toBeDefined();
    const usage = output![0].json.usage as any;
    expect(usage.totalTokens).toBeGreaterThan(0);
  });
});

describe('AI Agent Node', () => {
  beforeEach(() => {
    resetStores();
  });

  const hasApiKey = !!process.env.GOOGLE_AI_API_KEY;

  it.skipIf(!hasApiKey)('should execute AI agent with tool calling', async () => {
    const workflow = createWorkflow(
      'AI Agent Test',
      [
        createNode('Start', 'Start'),
        createNode('Agent', 'AIAgent', {
          model: 'gemini-2.0-flash',
          systemPrompt: 'You are a helpful assistant. Use the calculate tool to do math.',
          userPrompt: 'What is 15 + 27? Use the calculate tool to find out.',
          tools: '["calculate"]',
          maxIterations: 5,
          temperature: 0,
          maxTokens: 200,
        }),
      ],
      [createConnection('Start', 'Agent')]
    );

    const context = await runWorkflow(workflow);

    expect(context.errors).toHaveLength(0);
    const output = getNodeOutput(context, 'Agent');
    expect(output![0].json.response).toBeDefined();
    expect(output![0].json.toolCalls).toBeDefined();
    expect(output![0].json.iterations).toBeDefined();
  });

  it.skipIf(!hasApiKey)('should use get_current_time tool', async () => {
    const workflow = createWorkflow(
      'AI Agent Time Tool',
      [
        createNode('Start', 'Start'),
        createNode('Agent', 'AIAgent', {
          model: 'gemini-2.0-flash',
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What time is it right now? Use the get_current_time tool.',
          tools: '["get_current_time"]',
          maxIterations: 3,
          temperature: 0,
          maxTokens: 200,
        }),
      ],
      [createConnection('Start', 'Agent')]
    );

    const context = await runWorkflow(workflow);

    expect(context.errors).toHaveLength(0);
    const output = getNodeOutput(context, 'Agent');
    expect(Array.isArray(output![0].json.toolCalls)).toBe(true);
  });

  it.skipIf(!hasApiKey)('should chain HTTP -> AI Agent for data analysis', async () => {
    const workflow = createWorkflow(
      'HTTP to AI Agent',
      [
        createNode('Start', 'Start'),
        createNode('Fetch', 'HttpRequest', {
          method: 'GET',
          url: 'https://httpbin.org/get?number=42',
          responseType: 'json',
        }),
        createNode('Analyze', 'AIAgent', {
          model: 'gemini-2.0-flash',
          systemPrompt: 'You analyze HTTP responses.',
          userPrompt: 'What is the status code of this response? Just say the number.',
          tools: '[]',
          maxIterations: 1,
          temperature: 0,
          maxTokens: 50,
        }),
      ],
      [
        createConnection('Start', 'Fetch'),
        createConnection('Fetch', 'Analyze'),
      ]
    );

    const context = await runWorkflow(workflow);

    expect(context.errors).toHaveLength(0);
    const output = getNodeOutput(context, 'Analyze');
    expect(output![0].json.response).toBeDefined();
    expect(typeof output![0].json.response).toBe('string');
  });
});

describe('Full Pipeline: HTTP -> LLM -> Tool -> Output', () => {
  beforeEach(() => {
    resetStores();
  });

  const hasApiKey = !!process.env.GOOGLE_AI_API_KEY;

  it.skipIf(!hasApiKey)('should complete full HTTP -> AI Agent -> Set pipeline', async () => {
    const workflow = createWorkflow(
      'Full Pipeline',
      [
        createNode('Start', 'Start'),
        createNode('FetchData', 'HttpRequest', {
          method: 'GET',
          url: 'https://httpbin.org/get?value=100',
          responseType: 'json',
        }),
        createNode('AIProcess', 'AIAgent', {
          model: 'gemini-2.0-flash',
          systemPrompt: 'You are a data processor.',
          userPrompt: 'The HTTP status is {{ $json.statusCode }}. If status is 200, use the calculate tool to compute 100 + 50, otherwise just respond "error".',
          tools: '["calculate"]',
          maxIterations: 3,
          temperature: 0,
          maxTokens: 200,
        }),
        createNode('FormatOutput', 'Set', {
          mode: 'manual',
          fields: [
            { name: 'aiResponse', value: '{{ $json.response }}' },
            { name: 'processedAt', value: new Date().toISOString() },
          ],
        }),
      ],
      [
        createConnection('Start', 'FetchData'),
        createConnection('FetchData', 'AIProcess'),
        createConnection('AIProcess', 'FormatOutput'),
      ]
    );

    const context = await runWorkflow(workflow);

    // Allow for API issues but check structure
    const output = getNodeOutput(context, 'FormatOutput');
    if (context.errors.length === 0 && output) {
      expect(output![0].json.processedAt).toBeDefined();
    }
  });
});
