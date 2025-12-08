/**
 * Node Chaining Tests
 * Tests for basic node chaining flows - replicates UI flows for connecting nodes
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

describe('Basic Node Chaining', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('Start -> Set chain', () => {
    it('should chain Start to Set node and add fields', async () => {
      const workflow = createWorkflow(
        'Start to Set',
        [
          createNode('Start', 'Start'),
          createNode('AddFields', 'Set', {
            mode: 'manual',
            fields: [
              { name: 'name', value: 'test' },
              { name: 'count', value: 42 },
            ],
          }),
        ],
        [createConnection('Start', 'AddFields')]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors).toHaveLength(0);
      const output = getNodeOutput(context, 'AddFields');
      expect(output![0].json.name).toBe('test');
      expect(output![0].json.count).toBe(42);
    });

    it('should chain multiple Set nodes', async () => {
      const workflow = createWorkflow(
        'Chained Sets',
        [
          createNode('Start', 'Start'),
          createNode('Set1', 'Set', {
            mode: 'manual',
            fields: [{ name: 'first', value: 'one' }],
          }),
          createNode('Set2', 'Set', {
            mode: 'manual',
            fields: [{ name: 'second', value: 'two' }],
          }),
          createNode('Set3', 'Set', {
            mode: 'manual',
            fields: [{ name: 'third', value: 'three' }],
          }),
        ],
        [
          createConnection('Start', 'Set1'),
          createConnection('Set1', 'Set2'),
          createConnection('Set2', 'Set3'),
        ]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors).toHaveLength(0);
      const output = getNodeOutput(context, 'Set3');
      expect(output![0].json.first).toBe('one');
      expect(output![0].json.second).toBe('two');
      expect(output![0].json.third).toBe('three');
    });
  });

  describe('Start -> Code chain', () => {
    it('should execute Code node and return transformed data', async () => {
      const workflow = createWorkflow(
        'Start to Code',
        [
          createNode('Start', 'Start'),
          createNode('Transform', 'Code', {
            code: `
              const result = items.map(item => ({
                json: {
                  ...item.json,
                  transformed: true,
                  computed: 10 * 5
                }
              }));
              return result;
            `,
          }),
        ],
        [createConnection('Start', 'Transform')]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { original: 'data' } },
      ]);

      expect(context.errors).toHaveLength(0);
      const output = getNodeOutput(context, 'Transform');
      expect(output![0].json.original).toBe('data');
      expect(output![0].json.transformed).toBe(true);
      expect(output![0].json.computed).toBe(50);
    });

    it('should access $json in Code node', async () => {
      const workflow = createWorkflow(
        'Code with $json',
        [
          createNode('Start', 'Start'),
          createNode('Process', 'Code', {
            code: `
              return [{
                json: {
                  name: $json.name,
                  uppercased: $json.name ? $json.name.toUpperCase() : 'NONE'
                }
              }];
            `,
          }),
        ],
        [createConnection('Start', 'Process')]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { name: 'hello' } },
      ]);

      const output = getNodeOutput(context, 'Process');
      expect(output![0].json.uppercased).toBe('HELLO');
    });
  });

  describe('Start -> Set -> Code chain', () => {
    it('should chain Start -> Set -> Code with data flowing through', async () => {
      const workflow = createWorkflow(
        'Three Node Chain',
        [
          createNode('Start', 'Start'),
          createNode('SetData', 'Set', {
            mode: 'manual',
            fields: [
              { name: 'value', value: 100 },
              { name: 'multiplier', value: 2 },
            ],
          }),
          createNode('Calculate', 'Code', {
            code: `
              return items.map(item => ({
                json: {
                  ...item.json,
                  result: item.json.value * item.json.multiplier
                }
              }));
            `,
          }),
        ],
        [
          createConnection('Start', 'SetData'),
          createConnection('SetData', 'Calculate'),
        ]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors).toHaveLength(0);
      const output = getNodeOutput(context, 'Calculate');
      expect(output![0].json.value).toBe(100);
      expect(output![0].json.multiplier).toBe(2);
      expect(output![0].json.result).toBe(200);
    });
  });

  describe('Set node operations', () => {
    it('should delete fields from data', async () => {
      const workflow = createWorkflow(
        'Delete Fields',
        [
          createNode('Start', 'Start'),
          createNode('Delete', 'Set', {
            mode: 'manual',
            fields: [],
            deleteFields: [{ path: 'toDelete' }],
          }),
        ],
        [createConnection('Start', 'Delete')]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { keep: 'value', toDelete: 'remove-me' } },
      ]);

      const output = getNodeOutput(context, 'Delete');
      expect(output![0].json.keep).toBe('value');
      expect(output![0].json.toDelete).toBeUndefined();
    });

    it('should rename fields', async () => {
      const workflow = createWorkflow(
        'Rename Fields',
        [
          createNode('Start', 'Start'),
          createNode('Rename', 'Set', {
            mode: 'manual',
            fields: [],
            renameFields: [{ from: 'oldName', to: 'newName' }],
          }),
        ],
        [createConnection('Start', 'Rename')]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { oldName: 'my-value' } },
      ]);

      const output = getNodeOutput(context, 'Rename');
      expect(output![0].json.newName).toBe('my-value');
      expect(output![0].json.oldName).toBeUndefined();
    });

    it('should merge JSON data in JSON mode', async () => {
      const workflow = createWorkflow(
        'JSON Mode',
        [
          createNode('Start', 'Start'),
          createNode('Merge', 'Set', {
            mode: 'json',
            jsonData: { merged: true, extra: 'data' },
          }),
        ],
        [createConnection('Start', 'Merge')]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { original: 'value' } },
      ]);

      const output = getNodeOutput(context, 'Merge');
      expect(output![0].json.original).toBe('value');
      expect(output![0].json.merged).toBe(true);
      expect(output![0].json.extra).toBe('data');
    });

    it('should handle keepOnlySet option', async () => {
      const workflow = createWorkflow(
        'Keep Only Set',
        [
          createNode('Start', 'Start'),
          createNode('Replace', 'Set', {
            mode: 'manual',
            keepOnlySet: true,
            fields: [{ name: 'newField', value: 'only-this' }],
          }),
        ],
        [createConnection('Start', 'Replace')]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { oldField: 'should-be-removed' } },
      ]);

      const output = getNodeOutput(context, 'Replace');
      expect(output![0].json.newField).toBe('only-this');
      expect(output![0].json.oldField).toBeUndefined();
    });

    it('should handle nested field paths with dot notation', async () => {
      const workflow = createWorkflow(
        'Nested Fields',
        [
          createNode('Start', 'Start'),
          createNode('SetNested', 'Set', {
            mode: 'manual',
            fields: [
              { name: 'user.name', value: 'John' },
              { name: 'user.email', value: 'john@example.com' },
            ],
          }),
        ],
        [createConnection('Start', 'SetNested')]
      );

      const context = await runWorkflow(workflow);

      const output = getNodeOutput(context, 'SetNested');
      expect(output![0].json.user).toBeDefined();
      expect((output![0].json.user as any).name).toBe('John');
      expect((output![0].json.user as any).email).toBe('john@example.com');
    });
  });

  describe('Wait node', () => {
    it('should wait for specified duration', async () => {
      const workflow = createWorkflow(
        'Wait Test',
        [
          createNode('Start', 'Start'),
          createNode('Wait', 'Wait', { duration: 100 }), // 100ms
          createNode('AfterWait', 'Set', {
            mode: 'manual',
            fields: [{ name: 'waited', value: true }],
          }),
        ],
        [
          createConnection('Start', 'Wait'),
          createConnection('Wait', 'AfterWait'),
        ]
      );

      const startTime = Date.now();
      const context = await runWorkflow(workflow);
      const elapsed = Date.now() - startTime;

      expect(context.errors).toHaveLength(0);
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some variance

      const output = getNodeOutput(context, 'AfterWait');
      expect(output![0].json.waited).toBe(true);
    });
  });

  describe('Data passthrough', () => {
    it('should pass multiple items through chain', async () => {
      const workflow = createWorkflow(
        'Multi Item',
        [
          createNode('Start', 'Start'),
          createNode('AddIndex', 'Code', {
            code: `
              return items.map((item, index) => ({
                json: { ...item.json, index }
              }));
            `,
          }),
        ],
        [createConnection('Start', 'AddIndex')]
      );

      const context = await runWorkflow(workflow, 'Start', [
        { json: { name: 'first' } },
        { json: { name: 'second' } },
        { json: { name: 'third' } },
      ]);

      const output = getNodeOutput(context, 'AddIndex');
      expect(output).toHaveLength(3);
      expect(output![0].json.name).toBe('first');
      expect(output![0].json.index).toBe(0);
      expect(output![2].json.name).toBe('third');
      expect(output![2].json.index).toBe(2);
    });
  });
});
