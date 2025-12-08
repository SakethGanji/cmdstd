/**
 * Merge and Parallel Execution Tests
 * Tests for Merge node and parallel branch execution - replicates UI flows for combining data
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

describe('Merge Node', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('append mode', () => {
    it('should concatenate data from two branches', async () => {
      const workflow = createWorkflow(
        'Merge Append',
        [
          createNode('Start', 'Start'),
          createNode('BranchA', 'Set', {
            mode: 'manual',
            fields: [{ name: 'branch', value: 'A' }],
          }),
          createNode('BranchB', 'Set', {
            mode: 'manual',
            fields: [{ name: 'branch', value: 'B' }],
          }),
          createNode('Combine', 'Merge', {
            mode: 'append',
          }),
        ],
        [
          createConnection('Start', 'BranchA'),
          createConnection('Start', 'BranchB'),
          createConnection('BranchA', 'Combine'),
          createConnection('BranchB', 'Combine'),
        ]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { id: 1 } },
      ]);

      expect(context.errors).toHaveLength(0);
      const output = getNodeOutput(context, 'Combine');
      expect(output).toBeDefined();
      // Should have items from both branches
      expect(output!.length).toBe(2);
      const branches = output!.map(o => o.json.branch);
      expect(branches).toContain('A');
      expect(branches).toContain('B');
    });

    it('should handle multiple items from each branch', async () => {
      const workflow = createWorkflow(
        'Merge Multiple Items',
        [
          createNode('Start', 'Start'),
          createNode('DuplicateA', 'Code', {
            code: `
              return [
                { json: { source: 'A', idx: 1 } },
                { json: { source: 'A', idx: 2 } }
              ];
            `,
          }),
          createNode('DuplicateB', 'Code', {
            code: `
              return [
                { json: { source: 'B', idx: 1 } },
                { json: { source: 'B', idx: 2 } },
                { json: { source: 'B', idx: 3 } }
              ];
            `,
          }),
          createNode('Combine', 'Merge', { mode: 'append' }),
        ],
        [
          createConnection('Start', 'DuplicateA'),
          createConnection('Start', 'DuplicateB'),
          createConnection('DuplicateA', 'Combine'),
          createConnection('DuplicateB', 'Combine'),
        ]
      );

      const context = await runWorkflow(workflow);

      const output = getNodeOutput(context, 'Combine');
      expect(output).toBeDefined();
      expect(output!.length).toBe(5); // 2 + 3 items
    });
  });

  describe('waitForAll mode', () => {
    it('should collect all inputs as arrays', async () => {
      const workflow = createWorkflow(
        'Merge WaitForAll',
        [
          createNode('Start', 'Start'),
          createNode('BranchA', 'Set', {
            mode: 'manual',
            fields: [{ name: 'data', value: 'from-A' }],
          }),
          createNode('BranchB', 'Set', {
            mode: 'manual',
            fields: [{ name: 'data', value: 'from-B' }],
          }),
          createNode('Combine', 'Merge', { mode: 'waitForAll' }),
        ],
        [
          createConnection('Start', 'BranchA'),
          createConnection('Start', 'BranchB'),
          createConnection('BranchA', 'Combine'),
          createConnection('BranchB', 'Combine'),
        ]
      );

      const context = await runWorkflow(workflow);

      const output = getNodeOutput(context, 'Combine');
      expect(output).toBeDefined();
      expect(output).toHaveLength(1);
      expect(output![0].json.inputs).toBeDefined();
      expect(Array.isArray(output![0].json.inputs)).toBe(true);
    });
  });

  describe('combinePairs mode', () => {
    it('should zip items from multiple branches', async () => {
      const workflow = createWorkflow(
        'Merge CombinePairs',
        [
          createNode('Start', 'Start'),
          createNode('BranchA', 'Code', {
            code: `
              return [
                { json: { name: 'Alice' } },
                { json: { name: 'Bob' } }
              ];
            `,
          }),
          createNode('BranchB', 'Code', {
            code: `
              return [
                { json: { score: 100 } },
                { json: { score: 85 } }
              ];
            `,
          }),
          createNode('Combine', 'Merge', { mode: 'combinePairs' }),
        ],
        [
          createConnection('Start', 'BranchA'),
          createConnection('Start', 'BranchB'),
          createConnection('BranchA', 'Combine'),
          createConnection('BranchB', 'Combine'),
        ]
      );

      const context = await runWorkflow(workflow);

      const output = getNodeOutput(context, 'Combine');
      expect(output).toBeDefined();
      expect(output!.length).toBe(2);
      // Each item should have input0 and input1
      expect(output![0].json.input0).toBeDefined();
      expect(output![0].json.input1).toBeDefined();
    });
  });

  describe('keepMatches mode', () => {
    it('should only keep items that match on specified field', async () => {
      const workflow = createWorkflow(
        'Merge KeepMatches',
        [
          createNode('Start', 'Start'),
          createNode('BranchA', 'Code', {
            code: `
              return [
                { json: { id: 1, name: 'Alice' } },
                { json: { id: 2, name: 'Bob' } },
                { json: { id: 3, name: 'Charlie' } }
              ];
            `,
          }),
          createNode('BranchB', 'Code', {
            code: `
              return [
                { json: { id: 1, score: 100 } },
                { json: { id: 3, score: 75 } }
              ];
            `,
          }),
          createNode('Combine', 'Merge', { mode: 'keepMatches', matchField: 'id' }),
        ],
        [
          createConnection('Start', 'BranchA'),
          createConnection('Start', 'BranchB'),
          createConnection('BranchA', 'Combine'),
          createConnection('BranchB', 'Combine'),
        ]
      );

      const context = await runWorkflow(workflow);

      const output = getNodeOutput(context, 'Combine');
      expect(output).toBeDefined();
      // Only items with id 1 and 3 should remain (matched in both branches)
      expect(output!.length).toBe(2);
      const ids = output!.map(o => o.json.id);
      expect(ids).toContain(1);
      expect(ids).toContain(3);
      expect(ids).not.toContain(2);
    });
  });
});

describe('Parallel Branch Execution', () => {
  beforeEach(() => {
    resetStores();
  });

  it('should execute parallel branches from single start', async () => {
    const workflow = createWorkflow(
      'Parallel Branches',
      [
        createNode('Start', 'Start'),
        createNode('Branch1', 'Set', {
          mode: 'manual',
          fields: [{ name: 'path', value: 'branch1' }],
        }),
        createNode('Branch2', 'Set', {
          mode: 'manual',
          fields: [{ name: 'path', value: 'branch2' }],
        }),
        createNode('Branch3', 'Set', {
          mode: 'manual',
          fields: [{ name: 'path', value: 'branch3' }],
        }),
      ],
      [
        createConnection('Start', 'Branch1'),
        createConnection('Start', 'Branch2'),
        createConnection('Start', 'Branch3'),
      ]
    );

    const context = await runWorkflow(workflow, 'Start', [
      { json: { initial: 'data' } },
    ]);

    expect(context.errors).toHaveLength(0);

    // All branches should have executed
    const b1 = getNodeOutput(context, 'Branch1');
    const b2 = getNodeOutput(context, 'Branch2');
    const b3 = getNodeOutput(context, 'Branch3');

    expect(b1).toBeDefined();
    expect(b2).toBeDefined();
    expect(b3).toBeDefined();

    expect(b1![0].json.path).toBe('branch1');
    expect(b2![0].json.path).toBe('branch2');
    expect(b3![0].json.path).toBe('branch3');
  });

  it('should split data through If and merge back', async () => {
    const workflow = createWorkflow(
      'Split and Merge',
      [
        createNode('Start', 'Start'),
        createNode('Split', 'If', {
          field: 'type',
          operation: 'equals',
          value: 'premium',
        }),
        createNode('PremiumProcess', 'Set', {
          mode: 'manual',
          fields: [{ name: 'discount', value: 20 }],
        }),
        createNode('StandardProcess', 'Set', {
          mode: 'manual',
          fields: [{ name: 'discount', value: 0 }],
        }),
        createNode('Merge', 'Merge', { mode: 'append' }),
        createNode('Final', 'Set', {
          mode: 'manual',
          fields: [{ name: 'processed', value: true }],
        }),
      ],
      [
        createConnection('Start', 'Split'),
        createConnection('Split', 'PremiumProcess', 'true', 'main'),
        createConnection('Split', 'StandardProcess', 'false', 'main'),
        createConnection('PremiumProcess', 'Merge'),
        createConnection('StandardProcess', 'Merge'),
        createConnection('Merge', 'Final'),
      ]
    );

    const context = await runWorkflow(workflow, 'Start', [
      { json: { type: 'premium', name: 'Premium User' } },
      { json: { type: 'standard', name: 'Standard User' } },
    ]);

    expect(context.errors).toHaveLength(0);

    const output = getNodeOutput(context, 'Final');
    expect(output).toBeDefined();
    expect(output!.length).toBe(2);

    const premiumItem = output!.find(o => o.json.type === 'premium');
    const standardItem = output!.find(o => o.json.type === 'standard');

    expect(premiumItem).toBeDefined();
    expect(standardItem).toBeDefined();
    expect(premiumItem!.json.discount).toBe(20);
    expect(standardItem!.json.discount).toBe(0);
    expect(premiumItem!.json.processed).toBe(true);
    expect(standardItem!.json.processed).toBe(true);
  });
});

describe('Complex Parallel Patterns', () => {
  beforeEach(() => {
    resetStores();
  });

  it('should handle parallel HTTP requests merged back', async () => {
    const workflow = createWorkflow(
      'Parallel HTTP',
      [
        createNode('Start', 'Start'),
        createNode('FetchAPI1', 'HttpRequest', {
          method: 'GET',
          url: 'https://httpbin.org/get?source=api1',
          responseType: 'json',
        }),
        createNode('FetchAPI2', 'HttpRequest', {
          method: 'GET',
          url: 'https://httpbin.org/get?source=api2',
          responseType: 'json',
        }),
        createNode('Combine', 'Merge', { mode: 'append' }),
        createNode('Process', 'Code', {
          code: `
            return [{
              json: {
                totalResponses: items.length,
                allSuccess: items.every(i => i.json.statusCode === 200)
              }
            }];
          `,
        }),
      ],
      [
        createConnection('Start', 'FetchAPI1'),
        createConnection('Start', 'FetchAPI2'),
        createConnection('FetchAPI1', 'Combine'),
        createConnection('FetchAPI2', 'Combine'),
        createConnection('Combine', 'Process'),
      ]
    );

    const context = await runWorkflow(workflow);

    expect(context.errors).toHaveLength(0);

    const output = getNodeOutput(context, 'Process');
    expect(output).toBeDefined();
    expect(output![0].json.totalResponses).toBe(2);
    expect(output![0].json.allSuccess).toBe(true);
  });

  it('should handle diamond pattern (split then merge)', async () => {
    /*
     *        Start
     *          |
     *       Switch
     *       /  |  \
     *      A   B   C
     *       \  |  /
     *        Merge
     *          |
     *         End
     */
    const workflow = createWorkflow(
      'Diamond Pattern',
      [
        createNode('Start', 'Start'),
        createNode('Route', 'Switch', {
          mode: 'rules',
          rules: [
            { output: 0, field: 'type', operation: 'equals', value: 'a' },
            { output: 1, field: 'type', operation: 'equals', value: 'b' },
          ],
          fallbackOutput: 2,
        }),
        createNode('ProcessA', 'Set', {
          mode: 'manual',
          fields: [{ name: 'processedBy', value: 'A' }],
        }),
        createNode('ProcessB', 'Set', {
          mode: 'manual',
          fields: [{ name: 'processedBy', value: 'B' }],
        }),
        createNode('ProcessC', 'Set', {
          mode: 'manual',
          fields: [{ name: 'processedBy', value: 'C' }],
        }),
        createNode('Combine', 'Merge', { mode: 'append' }),
        createNode('Finalize', 'Set', {
          mode: 'manual',
          fields: [{ name: 'finalized', value: true }],
        }),
      ],
      [
        createConnection('Start', 'Route'),
        createConnection('Route', 'ProcessA', 'output0', 'main'),
        createConnection('Route', 'ProcessB', 'output1', 'main'),
        createConnection('Route', 'ProcessC', 'output2', 'main'),
        createConnection('ProcessA', 'Combine'),
        createConnection('ProcessB', 'Combine'),
        createConnection('ProcessC', 'Combine'),
        createConnection('Combine', 'Finalize'),
      ]
    );

    const context = await runWorkflow(workflow, 'Start', [
      { json: { id: 1, type: 'a' } },
      { json: { id: 2, type: 'b' } },
      { json: { id: 3, type: 'c' } },
    ]);

    expect(context.errors).toHaveLength(0);

    const output = getNodeOutput(context, 'Finalize');
    expect(output).toBeDefined();
    expect(output!.length).toBe(3);

    const itemA = output!.find(o => o.json.type === 'a');
    const itemB = output!.find(o => o.json.type === 'b');
    const itemC = output!.find(o => o.json.type === 'c');

    expect(itemA!.json.processedBy).toBe('A');
    expect(itemB!.json.processedBy).toBe('B');
    expect(itemC!.json.processedBy).toBe('C');

    // All should be finalized
    expect(output!.every(o => o.json.finalized)).toBe(true);
  });

  it('should handle nested parallel branches', async () => {
    /*
     *      Start
     *       / \
     *      A   B
     *     /\   /\
     *   A1 A2 B1 B2
     *     \/ \/
     *    Merge1 Merge2
     *       \  /
     *      FinalMerge
     */
    const workflow = createWorkflow(
      'Nested Parallel',
      [
        createNode('Start', 'Start'),
        // First level split
        createNode('BranchA', 'Set', {
          mode: 'manual',
          fields: [{ name: 'level1', value: 'A' }],
        }),
        createNode('BranchB', 'Set', {
          mode: 'manual',
          fields: [{ name: 'level1', value: 'B' }],
        }),
        // Second level split from A
        createNode('BranchA1', 'Set', {
          mode: 'manual',
          fields: [{ name: 'level2', value: 'A1' }],
        }),
        createNode('BranchA2', 'Set', {
          mode: 'manual',
          fields: [{ name: 'level2', value: 'A2' }],
        }),
        // Second level split from B
        createNode('BranchB1', 'Set', {
          mode: 'manual',
          fields: [{ name: 'level2', value: 'B1' }],
        }),
        createNode('BranchB2', 'Set', {
          mode: 'manual',
          fields: [{ name: 'level2', value: 'B2' }],
        }),
        // Merges
        createNode('MergeA', 'Merge', { mode: 'append' }),
        createNode('MergeB', 'Merge', { mode: 'append' }),
        createNode('FinalMerge', 'Merge', { mode: 'append' }),
      ],
      [
        createConnection('Start', 'BranchA'),
        createConnection('Start', 'BranchB'),
        createConnection('BranchA', 'BranchA1'),
        createConnection('BranchA', 'BranchA2'),
        createConnection('BranchB', 'BranchB1'),
        createConnection('BranchB', 'BranchB2'),
        createConnection('BranchA1', 'MergeA'),
        createConnection('BranchA2', 'MergeA'),
        createConnection('BranchB1', 'MergeB'),
        createConnection('BranchB2', 'MergeB'),
        createConnection('MergeA', 'FinalMerge'),
        createConnection('MergeB', 'FinalMerge'),
      ]
    );

    const context = await runWorkflow(workflow, 'Start', [
      { json: { original: 'data' } },
    ]);

    expect(context.errors).toHaveLength(0);

    const output = getNodeOutput(context, 'FinalMerge');
    expect(output).toBeDefined();
    // Should have 4 items: A1, A2, B1, B2
    expect(output!.length).toBe(4);

    const level2Values = output!.map(o => o.json.level2);
    expect(level2Values).toContain('A1');
    expect(level2Values).toContain('A2');
    expect(level2Values).toContain('B1');
    expect(level2Values).toContain('B2');
  });
});
