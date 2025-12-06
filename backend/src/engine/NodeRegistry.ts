import type { INode, NodeConstructor } from './types.js';
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

class NodeRegistryClass {
  private nodes = new Map<string, NodeConstructor>();

  register(NodeClass: NodeConstructor): void {
    const instance = new NodeClass();
    this.nodes.set(instance.type, NodeClass);
  }

  get(type: string): INode {
    const NodeClass = this.nodes.get(type);
    if (!NodeClass) {
      throw new Error(`Unknown node type: "${type}"`);
    }
    return new NodeClass();
  }

  has(type: string): boolean {
    return this.nodes.has(type);
  }

  list(): string[] {
    return Array.from(this.nodes.keys());
  }

  getNodeInfo(): Array<{ type: string; description: string; inputCount?: number }> {
    return Array.from(this.nodes.values()).map((NodeClass) => {
      const instance = new NodeClass();
      return {
        type: instance.type,
        description: instance.description,
        inputCount: instance.inputCount,
      };
    });
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
