/**
 * Conditional Flow Tests
 * Tests for If and Switch nodes - replicates UI flows for branching logic
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

describe('If Node', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('basic conditions', () => {
    it('should route to true output when condition matches', async () => {
      const workflow = createWorkflow(
        'If True Test',
        [
          createNode('Start', 'Start'),
          createNode('Check', 'If', {
            field: 'status',
            operation: 'equals',
            value: 'active',
          }),
          createNode('TrueHandler', 'Set', {
            mode: 'manual',
            fields: [{ name: 'result', value: 'was-true' }],
          }),
          createNode('FalseHandler', 'Set', {
            mode: 'manual',
            fields: [{ name: 'result', value: 'was-false' }],
          }),
        ],
        [
          createConnection('Start', 'Check'),
          createConnection('Check', 'TrueHandler', 'true', 'main'),
          createConnection('Check', 'FalseHandler', 'false', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { status: 'active' } },
      ]);

      expect(context.errors).toHaveLength(0);

      const trueOutput = getNodeOutput(context, 'TrueHandler');
      const falseOutput = getNodeOutput(context, 'FalseHandler');

      expect(trueOutput).toBeDefined();
      expect(trueOutput![0].json.result).toBe('was-true');
      expect(falseOutput).toBeUndefined();
    });

    it('should route to false output when condition does not match', async () => {
      const workflow = createWorkflow(
        'If False Test',
        [
          createNode('Start', 'Start'),
          createNode('Check', 'If', {
            field: 'status',
            operation: 'equals',
            value: 'active',
          }),
          createNode('TrueHandler', 'Set', {
            mode: 'manual',
            fields: [{ name: 'result', value: 'was-true' }],
          }),
          createNode('FalseHandler', 'Set', {
            mode: 'manual',
            fields: [{ name: 'result', value: 'was-false' }],
          }),
        ],
        [
          createConnection('Start', 'Check'),
          createConnection('Check', 'TrueHandler', 'true', 'main'),
          createConnection('Check', 'FalseHandler', 'false', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { status: 'inactive' } },
      ]);

      expect(context.errors).toHaveLength(0);

      const trueOutput = getNodeOutput(context, 'TrueHandler');
      const falseOutput = getNodeOutput(context, 'FalseHandler');

      expect(falseOutput).toBeDefined();
      expect(falseOutput![0].json.result).toBe('was-false');
      expect(trueOutput).toBeUndefined();
    });
  });

  describe('operations', () => {
    it('should handle notEquals operation', async () => {
      const workflow = createWorkflow(
        'NotEquals Test',
        [
          createNode('Start', 'Start'),
          createNode('Check', 'If', {
            field: 'value',
            operation: 'notEquals',
            value: 'bad',
          }),
          createNode('TrueHandler', 'Set', {
            mode: 'manual',
            fields: [{ name: 'matched', value: true }],
          }),
        ],
        [
          createConnection('Start', 'Check'),
          createConnection('Check', 'TrueHandler', 'true', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { value: 'good' } },
      ]);

      const output = getNodeOutput(context, 'TrueHandler');
      expect(output).toBeDefined();
      expect(output![0].json.matched).toBe(true);
    });

    it('should handle contains operation', async () => {
      const workflow = createWorkflow(
        'Contains Test',
        [
          createNode('Start', 'Start'),
          createNode('Check', 'If', {
            field: 'text',
            operation: 'contains',
            value: 'hello',
          }),
          createNode('TrueHandler', 'Set', {
            mode: 'manual',
            fields: [{ name: 'found', value: true }],
          }),
        ],
        [
          createConnection('Start', 'Check'),
          createConnection('Check', 'TrueHandler', 'true', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { text: 'say hello world' } },
      ]);

      const output = getNodeOutput(context, 'TrueHandler');
      expect(output).toBeDefined();
      expect(output![0].json.found).toBe(true);
    });

    it('should handle greater than operation', async () => {
      const workflow = createWorkflow(
        'GT Test',
        [
          createNode('Start', 'Start'),
          createNode('Check', 'If', {
            field: 'count',
            operation: 'gt',
            value: 10,
          }),
          createNode('TrueHandler', 'Set', {
            mode: 'manual',
            fields: [{ name: 'isHigh', value: true }],
          }),
        ],
        [
          createConnection('Start', 'Check'),
          createConnection('Check', 'TrueHandler', 'true', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { count: 50 } },
      ]);

      const output = getNodeOutput(context, 'TrueHandler');
      expect(output).toBeDefined();
      expect(output![0].json.isHigh).toBe(true);
    });

    it('should handle less than or equal operation', async () => {
      const workflow = createWorkflow(
        'LTE Test',
        [
          createNode('Start', 'Start'),
          createNode('Check', 'If', {
            field: 'score',
            operation: 'lte',
            value: 100,
          }),
          createNode('TrueHandler', 'Set', {
            mode: 'manual',
            fields: [{ name: 'valid', value: true }],
          }),
        ],
        [
          createConnection('Start', 'Check'),
          createConnection('Check', 'TrueHandler', 'true', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { score: 100 } },
      ]);

      const output = getNodeOutput(context, 'TrueHandler');
      expect(output).toBeDefined();
      expect(output![0].json.valid).toBe(true);
    });

    it('should handle isEmpty operation', async () => {
      const workflow = createWorkflow(
        'IsEmpty Test',
        [
          createNode('Start', 'Start'),
          createNode('Check', 'If', {
            field: 'optionalField',
            operation: 'isEmpty',
          }),
          createNode('TrueHandler', 'Set', {
            mode: 'manual',
            fields: [{ name: 'wasEmpty', value: true }],
          }),
        ],
        [
          createConnection('Start', 'Check'),
          createConnection('Check', 'TrueHandler', 'true', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { optionalField: '' } },
      ]);

      const output = getNodeOutput(context, 'TrueHandler');
      expect(output).toBeDefined();
      expect(output![0].json.wasEmpty).toBe(true);
    });

    it('should handle isTrue operation', async () => {
      const workflow = createWorkflow(
        'IsTrue Test',
        [
          createNode('Start', 'Start'),
          createNode('Check', 'If', {
            field: 'active',
            operation: 'isTrue',
          }),
          createNode('TrueHandler', 'Set', {
            mode: 'manual',
            fields: [{ name: 'isActive', value: true }],
          }),
        ],
        [
          createConnection('Start', 'Check'),
          createConnection('Check', 'TrueHandler', 'true', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { active: true } },
      ]);

      const output = getNodeOutput(context, 'TrueHandler');
      expect(output).toBeDefined();
    });

    it('should handle regex operation', async () => {
      const workflow = createWorkflow(
        'Regex Test',
        [
          createNode('Start', 'Start'),
          createNode('Check', 'If', {
            field: 'email',
            operation: 'regex',
            value: '^[a-z]+@[a-z]+\\.[a-z]+$',
          }),
          createNode('TrueHandler', 'Set', {
            mode: 'manual',
            fields: [{ name: 'validEmail', value: true }],
          }),
        ],
        [
          createConnection('Start', 'Check'),
          createConnection('Check', 'TrueHandler', 'true', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { email: 'test@example.com' } },
      ]);

      const output = getNodeOutput(context, 'TrueHandler');
      expect(output).toBeDefined();
      expect(output![0].json.validEmail).toBe(true);
    });
  });

  describe('nested field access', () => {
    it('should access nested fields with dot notation', async () => {
      const workflow = createWorkflow(
        'Nested Field Test',
        [
          createNode('Start', 'Start'),
          createNode('Check', 'If', {
            field: 'user.role',
            operation: 'equals',
            value: 'admin',
          }),
          createNode('TrueHandler', 'Set', {
            mode: 'manual',
            fields: [{ name: 'isAdmin', value: true }],
          }),
        ],
        [
          createConnection('Start', 'Check'),
          createConnection('Check', 'TrueHandler', 'true', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { user: { role: 'admin', name: 'John' } } },
      ]);

      const output = getNodeOutput(context, 'TrueHandler');
      expect(output).toBeDefined();
      expect(output![0].json.isAdmin).toBe(true);
    });
  });

  describe('multiple items', () => {
    it('should route items to different outputs based on condition', async () => {
      const workflow = createWorkflow(
        'Multi Item Routing',
        [
          createNode('Start', 'Start'),
          createNode('Check', 'If', {
            field: 'type',
            operation: 'equals',
            value: 'A',
          }),
          createNode('TypeA', 'Set', {
            mode: 'manual',
            fields: [{ name: 'handledAs', value: 'type-A' }],
          }),
          createNode('NotTypeA', 'Set', {
            mode: 'manual',
            fields: [{ name: 'handledAs', value: 'not-type-A' }],
          }),
        ],
        [
          createConnection('Start', 'Check'),
          createConnection('Check', 'TypeA', 'true', 'main'),
          createConnection('Check', 'NotTypeA', 'false', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { type: 'A', id: 1 } },
        { json: { type: 'B', id: 2 } },
        { json: { type: 'A', id: 3 } },
      ]);

      const typeAOutput = getNodeOutput(context, 'TypeA');
      const notTypeAOutput = getNodeOutput(context, 'NotTypeA');

      expect(typeAOutput).toHaveLength(2);
      expect(notTypeAOutput).toHaveLength(1);
      expect(typeAOutput![0].json.id).toBe(1);
      expect(typeAOutput![1].json.id).toBe(3);
      expect(notTypeAOutput![0].json.id).toBe(2);
    });
  });
});

describe('Switch Node', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('rules mode', () => {
    it('should route to correct output based on rule', async () => {
      const workflow = createWorkflow(
        'Switch Rules Test',
        [
          createNode('Start', 'Start'),
          createNode('Route', 'Switch', {
            mode: 'rules',
            rules: [
              { output: 0, field: 'category', operation: 'equals', value: 'electronics' },
              { output: 1, field: 'category', operation: 'equals', value: 'clothing' },
              { output: 2, field: 'category', operation: 'equals', value: 'food' },
            ],
            fallbackOutput: 3,
          }),
          createNode('Electronics', 'Set', {
            mode: 'manual',
            fields: [{ name: 'dept', value: 'electronics' }],
          }),
          createNode('Clothing', 'Set', {
            mode: 'manual',
            fields: [{ name: 'dept', value: 'clothing' }],
          }),
          createNode('Food', 'Set', {
            mode: 'manual',
            fields: [{ name: 'dept', value: 'food' }],
          }),
          createNode('Other', 'Set', {
            mode: 'manual',
            fields: [{ name: 'dept', value: 'other' }],
          }),
        ],
        [
          createConnection('Start', 'Route'),
          createConnection('Route', 'Electronics', 'output0', 'main'),
          createConnection('Route', 'Clothing', 'output1', 'main'),
          createConnection('Route', 'Food', 'output2', 'main'),
          createConnection('Route', 'Other', 'output3', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { category: 'clothing', name: 'shirt' } },
      ]);

      expect(context.errors).toHaveLength(0);
      const clothingOutput = getNodeOutput(context, 'Clothing');
      expect(clothingOutput).toBeDefined();
      expect(clothingOutput![0].json.dept).toBe('clothing');
      expect(clothingOutput![0].json.name).toBe('shirt');
    });

    it('should route to fallback when no rules match', async () => {
      const workflow = createWorkflow(
        'Switch Fallback Test',
        [
          createNode('Start', 'Start'),
          createNode('Route', 'Switch', {
            mode: 'rules',
            rules: [
              { output: 0, field: 'type', operation: 'equals', value: 'known' },
            ],
            fallbackOutput: 1,
          }),
          createNode('Known', 'Set', {
            mode: 'manual',
            fields: [{ name: 'handled', value: 'known' }],
          }),
          createNode('Unknown', 'Set', {
            mode: 'manual',
            fields: [{ name: 'handled', value: 'unknown' }],
          }),
        ],
        [
          createConnection('Start', 'Route'),
          createConnection('Route', 'Known', 'output0', 'main'),
          createConnection('Route', 'Unknown', 'output1', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { type: 'something-else' } },
      ]);

      const unknownOutput = getNodeOutput(context, 'Unknown');
      expect(unknownOutput).toBeDefined();
      expect(unknownOutput![0].json.handled).toBe('unknown');
    });

    it('should route multiple items to different outputs', async () => {
      const workflow = createWorkflow(
        'Switch Multi Items',
        [
          createNode('Start', 'Start'),
          createNode('Route', 'Switch', {
            mode: 'rules',
            rules: [
              { output: 0, field: 'priority', operation: 'equals', value: 'high' },
              { output: 1, field: 'priority', operation: 'equals', value: 'low' },
            ],
            fallbackOutput: 2,
          }),
          createNode('High', 'Set', {
            mode: 'manual',
            fields: [{ name: 'queue', value: 'urgent' }],
          }),
          createNode('Low', 'Set', {
            mode: 'manual',
            fields: [{ name: 'queue', value: 'normal' }],
          }),
          createNode('Default', 'Set', {
            mode: 'manual',
            fields: [{ name: 'queue', value: 'default' }],
          }),
        ],
        [
          createConnection('Start', 'Route'),
          createConnection('Route', 'High', 'output0', 'main'),
          createConnection('Route', 'Low', 'output1', 'main'),
          createConnection('Route', 'Default', 'output2', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { id: 1, priority: 'high' } },
        { json: { id: 2, priority: 'low' } },
        { json: { id: 3, priority: 'medium' } },
        { json: { id: 4, priority: 'high' } },
      ]);

      const highOutput = getNodeOutput(context, 'High');
      const lowOutput = getNodeOutput(context, 'Low');
      const defaultOutput = getNodeOutput(context, 'Default');

      expect(highOutput).toHaveLength(2);
      expect(lowOutput).toHaveLength(1);
      expect(defaultOutput).toHaveLength(1);
    });
  });

  describe('switch operations', () => {
    it('should handle startsWith operation', async () => {
      const workflow = createWorkflow(
        'StartsWith Test',
        [
          createNode('Start', 'Start'),
          createNode('Route', 'Switch', {
            mode: 'rules',
            rules: [
              { output: 0, field: 'code', operation: 'startsWith', value: 'ERR' },
            ],
            fallbackOutput: 1,
          }),
          createNode('Error', 'Set', {
            mode: 'manual',
            fields: [{ name: 'type', value: 'error' }],
          }),
          createNode('Other', 'Set', {
            mode: 'manual',
            fields: [{ name: 'type', value: 'other' }],
          }),
        ],
        [
          createConnection('Start', 'Route'),
          createConnection('Route', 'Error', 'output0', 'main'),
          createConnection('Route', 'Other', 'output1', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { code: 'ERR_001' } },
      ]);

      const errorOutput = getNodeOutput(context, 'Error');
      expect(errorOutput).toBeDefined();
      expect(errorOutput![0].json.type).toBe('error');
    });

    it('should handle numeric comparisons in rules', async () => {
      const workflow = createWorkflow(
        'Numeric Switch Test',
        [
          createNode('Start', 'Start'),
          createNode('Route', 'Switch', {
            mode: 'rules',
            rules: [
              { output: 0, field: 'score', operation: 'gte', value: 90 },
              { output: 1, field: 'score', operation: 'gte', value: 70 },
              { output: 2, field: 'score', operation: 'gte', value: 50 },
            ],
            fallbackOutput: 3,
          }),
          createNode('A', 'Set', { mode: 'manual', fields: [{ name: 'grade', value: 'A' }] }),
          createNode('B', 'Set', { mode: 'manual', fields: [{ name: 'grade', value: 'B' }] }),
          createNode('C', 'Set', { mode: 'manual', fields: [{ name: 'grade', value: 'C' }] }),
          createNode('F', 'Set', { mode: 'manual', fields: [{ name: 'grade', value: 'F' }] }),
        ],
        [
          createConnection('Start', 'Route'),
          createConnection('Route', 'A', 'output0', 'main'),
          createConnection('Route', 'B', 'output1', 'main'),
          createConnection('Route', 'C', 'output2', 'main'),
          createConnection('Route', 'F', 'output3', 'main'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { score: 95 } },
        { json: { score: 75 } },
        { json: { score: 55 } },
        { json: { score: 30 } },
      ]);

      const aOutput = getNodeOutput(context, 'A');
      const bOutput = getNodeOutput(context, 'B');
      const cOutput = getNodeOutput(context, 'C');
      const fOutput = getNodeOutput(context, 'F');

      expect(aOutput).toHaveLength(1);
      expect(aOutput![0].json.score).toBe(95);
      expect(bOutput).toHaveLength(1);
      expect(bOutput![0].json.score).toBe(75);
      expect(cOutput).toHaveLength(1);
      expect(fOutput).toHaveLength(1);
    });
  });
});

describe('Chained Conditional Logic', () => {
  beforeEach(() => {
    resetStores();
  });

  it('should chain If -> Switch for complex routing', async () => {
    const workflow = createWorkflow(
      'Chained Conditionals',
      [
        createNode('Start', 'Start'),
        createNode('CheckAuth', 'If', {
          field: 'authenticated',
          operation: 'isTrue',
        }),
        createNode('RouteRole', 'Switch', {
          mode: 'rules',
          rules: [
            { output: 0, field: 'role', operation: 'equals', value: 'admin' },
            { output: 1, field: 'role', operation: 'equals', value: 'user' },
          ],
          fallbackOutput: 2,
        }),
        createNode('Unauthorized', 'Set', {
          mode: 'manual',
          fields: [{ name: 'access', value: 'denied' }],
        }),
        createNode('AdminAccess', 'Set', {
          mode: 'manual',
          fields: [{ name: 'access', value: 'admin' }],
        }),
        createNode('UserAccess', 'Set', {
          mode: 'manual',
          fields: [{ name: 'access', value: 'user' }],
        }),
        createNode('GuestAccess', 'Set', {
          mode: 'manual',
          fields: [{ name: 'access', value: 'guest' }],
        }),
      ],
      [
        createConnection('Start', 'CheckAuth'),
        createConnection('CheckAuth', 'RouteRole', 'true', 'main'),
        createConnection('CheckAuth', 'Unauthorized', 'false', 'main'),
        createConnection('RouteRole', 'AdminAccess', 'output0', 'main'),
        createConnection('RouteRole', 'UserAccess', 'output1', 'main'),
        createConnection('RouteRole', 'GuestAccess', 'output2', 'main'),
      ]
    );

    // Test admin access
    const adminContext = await runWorkflow(workflow, 'Start', [
      { json: { authenticated: true, role: 'admin' } },
    ]);
    const adminOutput = getNodeOutput(adminContext, 'AdminAccess');
    expect(adminOutput![0].json.access).toBe('admin');

    // Test unauthorized
    const unauthContext = await runWorkflow(workflow, 'Start', [
      { json: { authenticated: false, role: 'admin' } },
    ]);
    const unauthOutput = getNodeOutput(unauthContext, 'Unauthorized');
    expect(unauthOutput![0].json.access).toBe('denied');
  });
});
