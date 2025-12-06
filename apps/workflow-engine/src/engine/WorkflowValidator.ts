import type { Workflow, NodeDefinition, Connection } from '../schemas/workflow.js';
import { NodeRegistry } from './NodeRegistry.js';

export interface ValidationError {
  type: 'error' | 'warning';
  code: string;
  message: string;
  nodeName?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

const TRIGGER_TYPES = ['Start', 'Webhook', 'Cron', 'ErrorTrigger'];

/**
 * Validates workflow structure and node configuration
 */
export class WorkflowValidator {
  /**
   * Validate a workflow and return all errors/warnings
   */
  validate(workflow: Workflow): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // 1. Must have at least one node
    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push({
        type: 'error',
        code: 'NO_NODES',
        message: 'Workflow must have at least one node',
      });
      return { valid: false, errors, warnings };
    }

    // 2. Check for duplicate node names
    const nodeNames = new Set<string>();
    for (const node of workflow.nodes) {
      if (nodeNames.has(node.name)) {
        errors.push({
          type: 'error',
          code: 'DUPLICATE_NODE_NAME',
          message: `Duplicate node name: "${node.name}"`,
          nodeName: node.name,
        });
      }
      nodeNames.add(node.name);
    }

    // 3. Validate each node type exists
    for (const node of workflow.nodes) {
      if (!NodeRegistry.has(node.type)) {
        errors.push({
          type: 'error',
          code: 'UNKNOWN_NODE_TYPE',
          message: `Unknown node type: "${node.type}"`,
          nodeName: node.name,
        });
      }
    }

    // 4. Must have at least one trigger node
    const triggerNodes = workflow.nodes.filter((n) => TRIGGER_TYPES.includes(n.type));
    if (triggerNodes.length === 0) {
      errors.push({
        type: 'error',
        code: 'NO_TRIGGER',
        message: 'Workflow must have at least one trigger node (Start, Webhook, Cron, or ErrorTrigger)',
      });
    }

    // 5. Trigger nodes should not have incoming connections
    for (const trigger of triggerNodes) {
      const incomingConnections = workflow.connections.filter(
        (c) => c.targetNode === trigger.name
      );
      if (incomingConnections.length > 0) {
        warnings.push({
          type: 'warning',
          code: 'TRIGGER_HAS_INPUT',
          message: `Trigger node "${trigger.name}" has incoming connections - these will be ignored`,
          nodeName: trigger.name,
        });
      }
    }

    // 6. Validate all connections reference existing nodes
    for (const conn of workflow.connections) {
      if (!nodeNames.has(conn.sourceNode)) {
        errors.push({
          type: 'error',
          code: 'INVALID_SOURCE_NODE',
          message: `Connection references non-existent source node: "${conn.sourceNode}"`,
        });
      }
      if (!nodeNames.has(conn.targetNode)) {
        errors.push({
          type: 'error',
          code: 'INVALID_TARGET_NODE',
          message: `Connection references non-existent target node: "${conn.targetNode}"`,
        });
      }
    }

    // 7. Check for self-referencing connections
    for (const conn of workflow.connections) {
      if (conn.sourceNode === conn.targetNode) {
        errors.push({
          type: 'error',
          code: 'SELF_REFERENCE',
          message: `Node "${conn.sourceNode}" cannot connect to itself`,
          nodeName: conn.sourceNode,
        });
      }
    }

    // 8. Check for unreachable nodes (not connected and not a trigger)
    const reachableNodes = this.findReachableNodes(workflow);
    for (const node of workflow.nodes) {
      if (!TRIGGER_TYPES.includes(node.type) && !reachableNodes.has(node.name)) {
        warnings.push({
          type: 'warning',
          code: 'UNREACHABLE_NODE',
          message: `Node "${node.name}" is not reachable from any trigger`,
          nodeName: node.name,
        });
      }
    }

    // 9. Check for cycles (loops are allowed only through loop outputs)
    const cycles = this.detectCycles(workflow);
    for (const cycle of cycles) {
      // Check if this is a valid loop (through SplitInBatches loop output)
      const lastConn = workflow.connections.find(
        (c) => c.sourceNode === cycle[cycle.length - 1] && c.targetNode === cycle[0]
      );
      if (!lastConn || lastConn.sourceOutput !== 'loop') {
        warnings.push({
          type: 'warning',
          code: 'POTENTIAL_CYCLE',
          message: `Potential infinite loop detected: ${cycle.join(' → ')} → ${cycle[0]}`,
        });
      }
    }

    // 10. Validate node-specific requirements
    for (const node of workflow.nodes) {
      const nodeErrors = this.validateNodeConfig(node, workflow);
      errors.push(...nodeErrors.filter((e) => e.type === 'error'));
      warnings.push(...nodeErrors.filter((e) => e.type === 'warning'));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Find all nodes reachable from trigger nodes
   */
  private findReachableNodes(workflow: Workflow): Set<string> {
    const reachable = new Set<string>();
    const queue: string[] = [];

    // Start from all trigger nodes
    for (const node of workflow.nodes) {
      if (TRIGGER_TYPES.includes(node.type)) {
        queue.push(node.name);
        reachable.add(node.name);
      }
    }

    // BFS to find all reachable nodes
    while (queue.length > 0) {
      const current = queue.shift()!;
      const outgoing = workflow.connections.filter((c) => c.sourceNode === current);

      for (const conn of outgoing) {
        if (!reachable.has(conn.targetNode)) {
          reachable.add(conn.targetNode);
          queue.push(conn.targetNode);
        }
      }
    }

    return reachable;
  }

  /**
   * Detect cycles in the workflow graph
   */
  private detectCycles(workflow: Workflow): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeName: string): void => {
      visited.add(nodeName);
      recursionStack.add(nodeName);
      path.push(nodeName);

      const outgoing = workflow.connections.filter((c) => c.sourceNode === nodeName);

      for (const conn of outgoing) {
        if (!visited.has(conn.targetNode)) {
          dfs(conn.targetNode);
        } else if (recursionStack.has(conn.targetNode)) {
          // Found a cycle
          const cycleStart = path.indexOf(conn.targetNode);
          cycles.push(path.slice(cycleStart));
        }
      }

      path.pop();
      recursionStack.delete(nodeName);
    };

    for (const node of workflow.nodes) {
      if (!visited.has(node.name)) {
        dfs(node.name);
      }
    }

    return cycles;
  }

  /**
   * Validate node-specific configuration
   */
  private validateNodeConfig(node: NodeDefinition, workflow: Workflow): ValidationError[] {
    const errors: ValidationError[] = [];

    switch (node.type) {
      case 'HttpRequest':
        if (!node.parameters.url) {
          errors.push({
            type: 'error',
            code: 'MISSING_URL',
            message: `HttpRequest node "${node.name}" requires a URL`,
            nodeName: node.name,
          });
        }
        break;

      case 'Merge':
        // Merge node should have at least 2 incoming connections
        const mergeInputs = workflow.connections.filter((c) => c.targetNode === node.name);
        if (mergeInputs.length < 2) {
          errors.push({
            type: 'warning',
            code: 'MERGE_SINGLE_INPUT',
            message: `Merge node "${node.name}" has fewer than 2 inputs`,
            nodeName: node.name,
          });
        }
        break;

      case 'If':
      case 'Switch':
        // Branching nodes should have at least one outgoing connection
        const branchOutputs = workflow.connections.filter((c) => c.sourceNode === node.name);
        if (branchOutputs.length === 0) {
          errors.push({
            type: 'warning',
            code: 'NO_BRANCH_OUTPUTS',
            message: `${node.type} node "${node.name}" has no outgoing connections`,
            nodeName: node.name,
          });
        }
        break;

      case 'Code':
        if (!node.parameters.code) {
          errors.push({
            type: 'error',
            code: 'MISSING_CODE',
            message: `Code node "${node.name}" requires code`,
            nodeName: node.name,
          });
        }
        break;
    }

    return errors;
  }
}

// Singleton instance
export const workflowValidator = new WorkflowValidator();
