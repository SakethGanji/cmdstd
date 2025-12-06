import type { Workflow } from '../schemas/workflow.js';
import type { StoredWorkflow } from '../engine/types.js';

/**
 * In-memory workflow storage for POC
 */
class WorkflowStoreClass {
  private workflows = new Map<string, StoredWorkflow>();

  create(workflow: Workflow): StoredWorkflow {
    const id = workflow.id || this.generateId();
    const stored: StoredWorkflow = {
      id,
      name: workflow.name,
      workflow: { ...workflow, id },
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.workflows.set(id, stored);
    return stored;
  }

  get(id: string): StoredWorkflow | undefined {
    return this.workflows.get(id);
  }

  getByWebhookPath(path: string): StoredWorkflow | undefined {
    // Webhook path format: /webhook/:workflowId
    const id = path.replace('/webhook/', '');
    const stored = this.workflows.get(id);
    if (stored?.active) {
      return stored;
    }
    return undefined;
  }

  list(): StoredWorkflow[] {
    return Array.from(this.workflows.values());
  }

  update(id: string, workflow: Partial<Workflow>): StoredWorkflow | undefined {
    const existing = this.workflows.get(id);
    if (!existing) return undefined;

    const updated: StoredWorkflow = {
      ...existing,
      name: workflow.name || existing.name,
      workflow: { ...existing.workflow, ...workflow, id },
      updatedAt: new Date(),
    };
    this.workflows.set(id, updated);
    return updated;
  }

  setActive(id: string, active: boolean): StoredWorkflow | undefined {
    const existing = this.workflows.get(id);
    if (!existing) return undefined;

    existing.active = active;
    existing.updatedAt = new Date();
    return existing;
  }

  delete(id: string): boolean {
    return this.workflows.delete(id);
  }

  clear(): void {
    this.workflows.clear();
  }

  private generateId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

export const WorkflowStore = new WorkflowStoreClass();
