/**
 * Workflow CRUD Tests
 * Tests for creating, reading, updating, and deleting workflows - replicates UI flows
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkflowStore,
  ExecutionStore,
  resetStores,
  createWorkflow,
  createNode,
  createConnection,
  runWorkflow,
} from './setup.js';

describe('Workflow CRUD Operations', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('create workflow', () => {
    it('should create a basic workflow with a single Start node', () => {
      const workflow = createWorkflow('Test Workflow', [
        createNode('Start', 'Start'),
      ]);

      const stored = WorkflowStore.create(workflow);

      expect(stored.id).toBeDefined();
      expect(stored.name).toBe('Test Workflow');
      expect(stored.workflow.nodes).toHaveLength(1);
      expect(stored.active).toBe(false);
    });

    it('should create workflow with multiple nodes and connections', () => {
      const workflow = createWorkflow(
        'Multi-Node Workflow',
        [
          createNode('Start', 'Start'),
          createNode('Process', 'Set', {
            mode: 'manual',
            fields: [{ name: 'processed', value: true }],
          }),
        ],
        [createConnection('Start', 'Process')]
      );

      const stored = WorkflowStore.create(workflow);

      expect(stored.workflow.nodes).toHaveLength(2);
      expect(stored.workflow.connections).toHaveLength(1);
    });

    it('should generate unique IDs for workflows', () => {
      const workflow1 = createWorkflow('Workflow 1', [createNode('Start1', 'Start')]);
      const workflow2 = createWorkflow('Workflow 2', [createNode('Start2', 'Start')]);

      const stored1 = WorkflowStore.create(workflow1);
      const stored2 = WorkflowStore.create(workflow2);

      expect(stored1.id).not.toBe(stored2.id);
    });

    it('should use provided ID if specified', () => {
      const workflow = {
        id: 'custom-id-123',
        name: 'Custom ID Workflow',
        nodes: [createNode('Start', 'Start')],
        connections: [],
      };

      const stored = WorkflowStore.create(workflow);

      expect(stored.id).toBe('custom-id-123');
    });
  });

  describe('read workflow', () => {
    it('should retrieve workflow by ID', () => {
      const workflow = createWorkflow('Test', [createNode('Start', 'Start')]);
      const created = WorkflowStore.create(workflow);

      const retrieved = WorkflowStore.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('Test');
    });

    it('should return undefined for non-existent workflow', () => {
      const retrieved = WorkflowStore.get('non-existent-id');

      expect(retrieved).toBeUndefined();
    });

    it('should list all workflows', () => {
      WorkflowStore.create(createWorkflow('Workflow 1', [createNode('S1', 'Start')]));
      WorkflowStore.create(createWorkflow('Workflow 2', [createNode('S2', 'Start')]));
      WorkflowStore.create(createWorkflow('Workflow 3', [createNode('S3', 'Start')]));

      const workflows = WorkflowStore.list();

      expect(workflows).toHaveLength(3);
    });
  });

  describe('update workflow', () => {
    it('should update workflow name', () => {
      const workflow = createWorkflow('Original', [createNode('Start', 'Start')]);
      const created = WorkflowStore.create(workflow);

      const updated = WorkflowStore.update(created.id, { name: 'Updated Name' });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated Name');
    });

    it('should update workflow nodes', () => {
      const workflow = createWorkflow('Test', [createNode('Start', 'Start')]);
      const created = WorkflowStore.create(workflow);

      const updated = WorkflowStore.update(created.id, {
        nodes: [
          createNode('Start', 'Start'),
          createNode('NewNode', 'Set'),
        ],
      });

      expect(updated!.workflow.nodes).toHaveLength(2);
    });

    it('should update workflow connections', () => {
      const workflow = createWorkflow('Test', [
        createNode('Start', 'Start'),
        createNode('End', 'Set'),
      ]);
      const created = WorkflowStore.create(workflow);

      const updated = WorkflowStore.update(created.id, {
        connections: [createConnection('Start', 'End')],
      });

      expect(updated!.workflow.connections).toHaveLength(1);
    });

    it('should return undefined when updating non-existent workflow', () => {
      const updated = WorkflowStore.update('non-existent', { name: 'Test' });

      expect(updated).toBeUndefined();
    });

    it('should update updatedAt timestamp', async () => {
      const workflow = createWorkflow('Test', [createNode('Start', 'Start')]);
      const created = WorkflowStore.create(workflow);
      const originalUpdatedAt = created.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = WorkflowStore.update(created.id, { name: 'New Name' });

      expect(updated!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('delete workflow', () => {
    it('should delete workflow by ID', () => {
      const workflow = createWorkflow('To Delete', [createNode('Start', 'Start')]);
      const created = WorkflowStore.create(workflow);

      const deleted = WorkflowStore.delete(created.id);

      expect(deleted).toBe(true);
      expect(WorkflowStore.get(created.id)).toBeUndefined();
    });

    it('should return false when deleting non-existent workflow', () => {
      const deleted = WorkflowStore.delete('non-existent');

      expect(deleted).toBe(false);
    });
  });

  describe('workflow activation', () => {
    it('should toggle workflow active state', () => {
      const workflow = createWorkflow('Test', [createNode('Start', 'Start')]);
      const created = WorkflowStore.create(workflow);

      expect(created.active).toBe(false);

      const activated = WorkflowStore.setActive(created.id, true);
      expect(activated!.active).toBe(true);

      const deactivated = WorkflowStore.setActive(created.id, false);
      expect(deactivated!.active).toBe(false);
    });

    it('should return undefined when activating non-existent workflow', () => {
      const result = WorkflowStore.setActive('non-existent', true);

      expect(result).toBeUndefined();
    });
  });

  describe('webhook path lookup', () => {
    it('should find active workflow by webhook path', () => {
      const workflow = createWorkflow('Webhook Test', [createNode('Webhook', 'Webhook')]);
      const created = WorkflowStore.create(workflow);
      WorkflowStore.setActive(created.id, true);

      const found = WorkflowStore.getByWebhookPath(`/webhook/${created.id}`);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it('should not find inactive workflow by webhook path', () => {
      const workflow = createWorkflow('Webhook Test', [createNode('Webhook', 'Webhook')]);
      const created = WorkflowStore.create(workflow);
      // Don't activate

      const found = WorkflowStore.getByWebhookPath(`/webhook/${created.id}`);

      expect(found).toBeUndefined();
    });
  });
});

describe('Workflow Execution', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('basic execution', () => {
    it('should execute a simple Start node workflow', async () => {
      const workflow = createWorkflow('Simple', [createNode('Start', 'Start')]);

      const context = await runWorkflow(workflow);

      expect(context.errors).toHaveLength(0);
      expect(context.nodeStates.has('Start')).toBe(true);
    });

    it('should pass data through connected nodes', async () => {
      const workflow = createWorkflow(
        'Pass Through',
        [
          createNode('Start', 'Start'),
          createNode('SetData', 'Set', {
            mode: 'manual',
            fields: [{ name: 'added', value: 'test-value' }],
          }),
        ],
        [createConnection('Start', 'SetData')]
      );

      const context = await runWorkflow(workflow);

      expect(context.errors).toHaveLength(0);
      const setOutput = context.nodeStates.get('SetData');
      expect(setOutput).toBeDefined();
      expect(setOutput![0].json.added).toBe('test-value');
    });

    it('should include initial data in execution', async () => {
      const workflow = createWorkflow('With Data', [createNode('Start', 'Start')]);

      const context = await runWorkflow(workflow, 'Start', [
        { json: { initialField: 'initial-value' } },
      ]);

      const startOutput = context.nodeStates.get('Start');
      expect(startOutput![0].json.initialField).toBe('initial-value');
    });
  });

  describe('execution store', () => {
    it('should record execution in ExecutionStore', async () => {
      const workflow = createWorkflow('Recorded', [createNode('Start', 'Start')]);
      const stored = WorkflowStore.create(workflow);

      const context = await runWorkflow(workflow);
      ExecutionStore.complete(context, stored.id, stored.name);

      const executions = ExecutionStore.list();
      expect(executions.length).toBeGreaterThan(0);
    });

    it('should retrieve execution by ID', async () => {
      const workflow = createWorkflow('Test', [createNode('Start', 'Start')]);
      const stored = WorkflowStore.create(workflow);

      const context = await runWorkflow(workflow);
      const execution = ExecutionStore.complete(context, stored.id, stored.name);

      const retrieved = ExecutionStore.get(execution.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.status).toBe('success');
    });

    it('should mark failed executions', async () => {
      const workflow = createWorkflow('Fail Test', [
        createNode('Start', 'Start'),
        createNode('Fail', 'HttpRequest', {
          url: 'not-a-valid-url',
          method: 'GET',
        }),
      ], [createConnection('Start', 'Fail')]);

      const context = await runWorkflow(workflow);
      ExecutionStore.complete(context, 'test-id', 'Fail Test');

      expect(context.errors.length).toBeGreaterThan(0);
    });

    it('should list executions filtered by workflow ID', async () => {
      const workflow1 = createWorkflow('W1', [createNode('S1', 'Start')]);
      const workflow2 = createWorkflow('W2', [createNode('S2', 'Start')]);
      const stored1 = WorkflowStore.create(workflow1);
      const stored2 = WorkflowStore.create(workflow2);

      const ctx1 = await runWorkflow(workflow1);
      const ctx2 = await runWorkflow(workflow2);

      ExecutionStore.complete(ctx1, stored1.id, stored1.name);
      ExecutionStore.complete(ctx2, stored2.id, stored2.name);

      const filtered = ExecutionStore.list(stored1.id);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].workflowId).toBe(stored1.id);
    });

    it('should delete execution', async () => {
      const workflow = createWorkflow('Test', [createNode('Start', 'Start')]);

      const context = await runWorkflow(workflow);
      const execution = ExecutionStore.complete(context, 'test-id', 'Test');

      expect(ExecutionStore.get(execution.id)).toBeDefined();

      const deleted = ExecutionStore.delete(execution.id);
      expect(deleted).toBe(true);
      expect(ExecutionStore.get(execution.id)).toBeUndefined();
    });

    it('should clear all executions', async () => {
      const workflow = createWorkflow('Test', [createNode('Start', 'Start')]);

      const ctx1 = await runWorkflow(workflow);
      const ctx2 = await runWorkflow(workflow);

      ExecutionStore.complete(ctx1, 'test-1', 'Test 1');
      ExecutionStore.complete(ctx2, 'test-2', 'Test 2');

      expect(ExecutionStore.list().length).toBeGreaterThan(0);

      ExecutionStore.clear();
      expect(ExecutionStore.list()).toHaveLength(0);
    });
  });
});
