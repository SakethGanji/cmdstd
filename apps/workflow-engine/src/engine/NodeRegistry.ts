import type { INode, NodeConstructor } from './types.js';
import type {
  INodeTypeDescription,
  INodeTypeInfo,
  INodeOutputDefinition,
} from './nodeSchema.js';
import {
  StartNode,
  WebhookNode,
  HttpRequestNode,
  SetNode,
  SwitchNode,
  IfNode,
  CodeNode,
  MergeNode,
  WaitNode,
  SplitInBatchesNode,
  CronNode,
  ErrorTriggerNode,
} from '../nodes/index.js';

/**
 * Entry for a registered node type
 */
interface NodeEntry {
  NodeClass: NodeConstructor;
  instance: INode;
  description?: INodeTypeDescription;
}

class NodeRegistryClass {
  private nodes = new Map<string, NodeEntry>();
  private registeredTypes = new Set<string>();

  /**
   * Register a node class
   * @throws Error if node type is already registered (prevents duplicates)
   */
  register(NodeClass: NodeConstructor): void {
    const instance = new NodeClass();

    // Validate no duplicates
    if (this.registeredTypes.has(instance.type)) {
      throw new Error(`Duplicate node type: ${instance.type}`);
    }

    // Get static nodeDescription if defined
    const description = (NodeClass as any).nodeDescription as
      | INodeTypeDescription
      | undefined;

    this.registeredTypes.add(instance.type);
    this.nodes.set(instance.type, {
      NodeClass,
      instance,
      description,
    });
  }

  /**
   * Get node instance by type
   */
  get(type: string): INode {
    const entry = this.nodes.get(type);
    if (!entry) {
      throw new Error(`Unknown node type: "${type}"`);
    }
    return new entry.NodeClass();
  }

  /**
   * Check if node type is registered
   */
  has(type: string): boolean {
    return this.nodes.has(type);
  }

  /**
   * List all registered node types
   */
  list(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Get node description for a specific type
   */
  getDefinition(type: string): INodeTypeDescription | null {
    return this.nodes.get(type)?.description || null;
  }

  /**
   * Get basic node info (legacy compatibility)
   */
  getNodeInfo(): Array<{ type: string; description: string; inputCount?: number }> {
    return Array.from(this.nodes.values()).map(({ instance }) => ({
      type: instance.type,
      description: instance.description,
      inputCount: instance.inputCount,
    }));
  }

  /**
   * Get full node info with schema for UI rendering
   * This is what the frontend uses to generate configuration forms
   */
  getNodeInfoFull(): INodeTypeInfo[] {
    return Array.from(this.nodes.values()).map(({ instance, description }) => {
      // Determine outputs
      let outputCount: number | 'dynamic' = 1;
      let outputs: INodeOutputDefinition[] = [
        { name: 'main', displayName: 'Main' },
      ];

      if (description?.outputs === 'dynamic') {
        outputCount = 'dynamic';
      } else if (description?.outputs && Array.isArray(description.outputs)) {
        outputs = description.outputs;
        outputCount = outputs.length;
      }

      return {
        type: instance.type,
        displayName: description?.displayName || instance.type,
        description: instance.description,
        icon: description?.icon,
        group: description?.group,
        inputCount: instance.inputCount || 1,
        outputCount,
        properties: description?.properties || [],
        inputs:
          description?.inputs === 'dynamic' ? undefined : description?.inputs,
        outputs: outputs,
        outputStrategy: description?.outputStrategy,
      };
    });
  }

  /**
   * Get full info for a specific node type
   */
  getNodeTypeInfo(type: string): INodeTypeInfo | null {
    const entry = this.nodes.get(type);
    if (!entry) return null;

    const { instance, description } = entry;

    let outputCount: number | 'dynamic' = 1;
    let outputs: INodeOutputDefinition[] = [
      { name: 'main', displayName: 'Main' },
    ];

    if (description?.outputs === 'dynamic') {
      outputCount = 'dynamic';
    } else if (description?.outputs && Array.isArray(description.outputs)) {
      outputs = description.outputs;
      outputCount = outputs.length;
    }

    return {
      type: instance.type,
      displayName: description?.displayName || instance.type,
      description: instance.description,
      icon: description?.icon,
      group: description?.group,
      inputCount: instance.inputCount || 1,
      outputCount,
      properties: description?.properties || [],
      inputs:
        description?.inputs === 'dynamic' ? undefined : description?.inputs,
      outputs: outputs,
      outputStrategy: description?.outputStrategy,
    };
  }
}

export const NodeRegistry = new NodeRegistryClass();

// Register all built-in nodes
NodeRegistry.register(StartNode);
NodeRegistry.register(WebhookNode);
NodeRegistry.register(HttpRequestNode);
NodeRegistry.register(SetNode);
NodeRegistry.register(SwitchNode);
NodeRegistry.register(IfNode);
NodeRegistry.register(CodeNode);
NodeRegistry.register(MergeNode);
NodeRegistry.register(WaitNode);
NodeRegistry.register(SplitInBatchesNode);
NodeRegistry.register(CronNode);
NodeRegistry.register(ErrorTriggerNode);
