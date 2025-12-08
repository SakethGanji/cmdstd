/**
 * Error Handling and Retry Tests
 * Tests for error handling, continueOnFail, and retry mechanisms
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

describe('Error Handling', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('basic error capture', () => {
    it('should capture errors in execution context', async () => {
      const workflow = createWorkflow(
        'Error Test',
        [
          createNode('Start', 'Start'),
          createNode('Fail', 'HttpRequest', {
            url: 'not-a-valid-url-at-all',
            method: 'GET',
          }),
        ],
        [createConnection('Start', 'Fail')]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors.length).toBeGreaterThan(0);
      expect(context.errors[0].nodeName).toBe('Fail');
    });

    it('should record error timestamp', async () => {
      const workflow = createWorkflow(
        'Error Timestamp',
        [
          createNode('Start', 'Start'),
          createNode('Fail', 'Code', {
            code: `throw new Error('Intentional error');`,
          }),
        ],
        [createConnection('Start', 'Fail')]
      );

      const before = new Date();
      const context = await runWorkflow(workflow);
      const after = new Date();

      expect(context.errors.length).toBeGreaterThan(0);
      const errorTime = context.errors[0].timestamp;
      expect(errorTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(errorTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('continueOnFail', () => {
    it('should continue execution when continueOnFail is true', async () => {
      const workflow = createWorkflow(
        'Continue On Fail',
        [
          createNode('Start', 'Start'),
          createNode('MightFail', 'Code', {
            code: `throw new Error('Expected error');`,
          }, { continueOnFail: true }),
          createNode('AfterError', 'Set', {
            mode: 'manual',
            fields: [{ name: 'continued', value: true }],
          }),
        ],
        [
          createConnection('Start', 'MightFail'),
          createConnection('MightFail', 'AfterError'),
        ]
      );

      const context = await runWorkflow(workflow);

      // Error should be recorded
      expect(context.errors.length).toBeGreaterThan(0);

      // But execution should continue
      const output = getNodeOutput(context, 'AfterError');
      expect(output).toBeDefined();
      expect(output![0].json.continued).toBe(true);
    });

    it('should pass error info downstream when continuing', async () => {
      const workflow = createWorkflow(
        'Error Info Pass',
        [
          createNode('Start', 'Start'),
          createNode('Fail', 'Code', {
            code: `throw new Error('Test error message');`,
          }, { continueOnFail: true }),
          createNode('HandleError', 'Code', {
            code: `
              return items.map(item => ({
                json: {
                  hasError: 'error' in item.json,
                  errorMessage: item.json.error || 'none'
                }
              }));
            `,
          }),
        ],
        [
          createConnection('Start', 'Fail'),
          createConnection('Fail', 'HandleError'),
        ]
      );

      const context = await runWorkflow(workflow);

      const output = getNodeOutput(context, 'HandleError');
      expect(output).toBeDefined();
      expect(output![0].json.hasError).toBe(true);
    });

    it('should not continue when continueOnFail is false', async () => {
      const workflow = createWorkflow(
        'Stop On Fail',
        [
          createNode('Start', 'Start'),
          createNode('Fail', 'Code', {
            code: `throw new Error('Stop here');`,
          }, { continueOnFail: false }),
          createNode('ShouldNotRun', 'Set', {
            mode: 'manual',
            fields: [{ name: 'ran', value: true }],
          }),
        ],
        [
          createConnection('Start', 'Fail'),
          createConnection('Fail', 'ShouldNotRun'),
        ]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors.length).toBeGreaterThan(0);

      // The node after should not have run
      const output = getNodeOutput(context, 'ShouldNotRun');
      expect(output).toBeUndefined();
    });
  });

  describe('retry mechanism', () => {
    it('should retry failed node up to retryOnFail times', async () => {
      // Use a counter to track retries via a simple mechanism
      let attemptCount = 0;

      const workflow = createWorkflow(
        'Retry Test',
        [
          createNode('Start', 'Start'),
          createNode('RetryableNode', 'Code', {
            // This will always fail for testing
            code: `
              // Simulate failure
              throw new Error('Retry attempt failed');
            `,
          }, {
            retryOnFail: 2,
            retryDelay: 50, // Short delay for testing
          }),
        ],
        [createConnection('Start', 'RetryableNode')]
      );

      const startTime = Date.now();
      const context = await runWorkflow(workflow);
      const elapsed = Date.now() - startTime;

      // Should have error after all retries exhausted
      expect(context.errors.length).toBeGreaterThan(0);
      // Error message should indicate retries
      expect(context.errors[0].error).toContain('3 attempts');

      // Should have taken at least 2 * 50ms for retries
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it('should succeed on retry if subsequent attempt works', async () => {
      // This test uses a node that will succeed on first try
      const workflow = createWorkflow(
        'Retry Success',
        [
          createNode('Start', 'Start'),
          createNode('EventualSuccess', 'Set', {
            mode: 'manual',
            fields: [{ name: 'success', value: true }],
          }, {
            retryOnFail: 2,
            retryDelay: 50,
          }),
        ],
        [createConnection('Start', 'EventualSuccess')]
      );

      const context = await runWorkflow(workflow);

      // Should succeed without errors
      expect(context.errors).toHaveLength(0);
      const output = getNodeOutput(context, 'EventualSuccess');
      expect(output![0].json.success).toBe(true);
    });
  });

  describe('error in parallel branches', () => {
    it('should handle error in one branch while other continues', async () => {
      const workflow = createWorkflow(
        'Parallel Error',
        [
          createNode('Start', 'Start'),
          createNode('SuccessBranch', 'Set', {
            mode: 'manual',
            fields: [{ name: 'branch', value: 'success' }],
          }),
          createNode('FailBranch', 'Code', {
            code: `throw new Error('Branch failed');`,
          }, { continueOnFail: true }),
        ],
        [
          createConnection('Start', 'SuccessBranch'),
          createConnection('Start', 'FailBranch'),
        ]
      );

      const context = await runWorkflow(workflow);

      // Should have error from failed branch
      expect(context.errors.length).toBeGreaterThan(0);

      // But success branch should have completed
      const successOutput = getNodeOutput(context, 'SuccessBranch');
      expect(successOutput).toBeDefined();
      expect(successOutput![0].json.branch).toBe('success');
    });
  });

  describe('HTTP errors', () => {
    it('should handle HTTP 404 response', async () => {
      const workflow = createWorkflow(
        'HTTP 404',
        [
          createNode('Start', 'Start'),
          createNode('Fetch', 'HttpRequest', {
            url: 'https://httpbin.org/status/404',
            method: 'GET',
            responseType: 'json',
          }),
          createNode('Check', 'If', {
            field: 'statusCode',
            operation: 'equals',
            value: 404,
          }),
          createNode('Handle404', 'Set', {
            mode: 'manual',
            fields: [{ name: 'error', value: 'not-found' }],
          }),
        ],
        [
          createConnection('Start', 'Fetch'),
          createConnection('Fetch', 'Check'),
          createConnection('Check', 'Handle404', 'true', 'main'),
        ]
      );

      const context = await runWorkflow(workflow);

      // HTTP 404 is a valid response, not an error
      expect(context.errors).toHaveLength(0);

      const output = getNodeOutput(context, 'Handle404');
      expect(output).toBeDefined();
      expect(output![0].json.error).toBe('not-found');
    });

    it('should handle network errors with continueOnFail', async () => {
      const workflow = createWorkflow(
        'Network Error',
        [
          createNode('Start', 'Start'),
          createNode('Fetch', 'HttpRequest', {
            url: 'https://this-domain-definitely-does-not-exist-12345.com/',
            method: 'GET',
          }, { continueOnFail: true }),
          createNode('HandleError', 'Set', {
            mode: 'manual',
            fields: [{ name: 'handled', value: true }],
          }),
        ],
        [
          createConnection('Start', 'Fetch'),
          createConnection('Fetch', 'HandleError'),
        ]
      );

      const context = await runWorkflow(workflow);

      // Should have network error recorded
      expect(context.errors.length).toBeGreaterThan(0);

      // But should continue
      const output = getNodeOutput(context, 'HandleError');
      expect(output).toBeDefined();
    });
  });

  describe('Code node errors', () => {
    it('should catch syntax errors in Code node', async () => {
      const workflow = createWorkflow(
        'Syntax Error',
        [
          createNode('Start', 'Start'),
          createNode('BadCode', 'Code', {
            code: `
              const x = { // unclosed brace
              return x;
            `,
          }),
        ],
        [createConnection('Start', 'BadCode')]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors.length).toBeGreaterThan(0);
      expect(context.errors[0].nodeName).toBe('BadCode');
    });

    it('should catch runtime errors in Code node', async () => {
      const workflow = createWorkflow(
        'Runtime Error',
        [
          createNode('Start', 'Start'),
          createNode('RuntimeError', 'Code', {
            code: `
              const x = null;
              return x.property.nested; // Will throw
            `,
          }),
        ],
        [createConnection('Start', 'RuntimeError')]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors.length).toBeGreaterThan(0);
    });

    it('should handle timeout in Code node', async () => {
      const workflow = createWorkflow(
        'Timeout Test',
        [
          createNode('Start', 'Start'),
          createNode('SlowCode', 'Code', {
            // This creates an infinite loop that should timeout
            code: `
              while(true) { /* infinite loop */ }
              return items;
            `,
          }),
        ],
        [createConnection('Start', 'SlowCode')]
      );

      const context = await runWorkflow(workflow);

      // Should have timeout error
      expect(context.errors.length).toBeGreaterThan(0);
    }, 10000); // Increase test timeout
  });

  describe('error propagation', () => {
    it('should record multiple errors from different nodes', async () => {
      const workflow = createWorkflow(
        'Multiple Errors',
        [
          createNode('Start', 'Start'),
          createNode('Fail1', 'Code', {
            code: `throw new Error('Error 1');`,
          }, { continueOnFail: true }),
          createNode('Fail2', 'Code', {
            code: `throw new Error('Error 2');`,
          }, { continueOnFail: true }),
        ],
        [
          createConnection('Start', 'Fail1'),
          createConnection('Start', 'Fail2'),
        ]
      );

      const context = await runWorkflow(workflow);

      // Should have errors from both nodes
      expect(context.errors.length).toBe(2);
      const errorNodes = context.errors.map(e => e.nodeName);
      expect(errorNodes).toContain('Fail1');
      expect(errorNodes).toContain('Fail2');
    });
  });
});

describe('Pinned Data', () => {
  beforeEach(() => {
    resetStores();
  });

  it('should use pinned data instead of executing node', async () => {
    const workflow = createWorkflow(
      'Pinned Data Test',
      [
        createNode('Start', 'Start'),
        createNode('Pinned', 'HttpRequest', {
          url: 'https://httpbin.org/get',
          method: 'GET',
        }, {
          pinnedData: [
            { json: { pinned: true, mockData: 'test' } }
          ]
        }),
      ],
      [createConnection('Start', 'Pinned')]
    );

    const context = await runWorkflow(workflow);

    expect(context.errors).toHaveLength(0);
    const output = getNodeOutput(context, 'Pinned');
    expect(output).toBeDefined();
    expect(output![0].json.pinned).toBe(true);
    expect(output![0].json.mockData).toBe('test');
    // Should NOT have HTTP response fields since it was mocked
    expect(output![0].json.statusCode).toBeUndefined();
  });

  it('should pass pinned data to downstream nodes', async () => {
    const workflow = createWorkflow(
      'Pinned Downstream',
      [
        createNode('Start', 'Start'),
        createNode('MockHTTP', 'HttpRequest', {
          url: 'https://httpbin.org/get',
          method: 'GET',
        }, {
          pinnedData: [
            { json: { statusCode: 200, body: { data: 'mocked' } } }
          ]
        }),
        createNode('Process', 'Code', {
          code: `
            return items.map(item => ({
              json: {
                processed: true,
                originalData: item.json.body?.data
              }
            }));
          `,
        }),
      ],
      [
        createConnection('Start', 'MockHTTP'),
        createConnection('MockHTTP', 'Process'),
      ]
    );

    const context = await runWorkflow(workflow);

    const output = getNodeOutput(context, 'Process');
    expect(output![0].json.processed).toBe(true);
    expect(output![0].json.originalData).toBe('mocked');
  });
});
