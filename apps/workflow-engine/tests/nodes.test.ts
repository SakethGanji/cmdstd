/**
 * Node Registry Tests
 * Tests for listing and retrieving node types - replicates UI flow for getting available nodes
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NodeRegistry, resetStores } from './setup.js';

describe('Node Registry', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('list nodes', () => {
    it('should list all registered node types', () => {
      const nodeTypes = NodeRegistry.list();

      expect(nodeTypes).toContain('Start');
      expect(nodeTypes).toContain('Webhook');
      expect(nodeTypes).toContain('HttpRequest');
      expect(nodeTypes).toContain('Set');
      expect(nodeTypes).toContain('If');
      expect(nodeTypes).toContain('Switch');
      expect(nodeTypes).toContain('Code');
      expect(nodeTypes).toContain('Merge');
      expect(nodeTypes).toContain('LLMChat');
      expect(nodeTypes).toContain('AIAgent');
    });

    it('should return full node info with schemas for UI rendering', () => {
      const nodeInfoList = NodeRegistry.getNodeInfoFull();

      expect(nodeInfoList.length).toBeGreaterThan(0);

      // Check that each node has required fields for UI
      for (const info of nodeInfoList) {
        expect(info.type).toBeDefined();
        expect(info.displayName).toBeDefined();
        expect(info.description).toBeDefined();
        expect(info.properties).toBeDefined();
        expect(Array.isArray(info.properties)).toBe(true);
      }
    });

    it('should include trigger nodes', () => {
      const nodeInfoList = NodeRegistry.getNodeInfoFull();

      const startNode = nodeInfoList.find(n => n.type === 'Start');
      const webhookNode = nodeInfoList.find(n => n.type === 'Webhook');
      const cronNode = nodeInfoList.find(n => n.type === 'Cron');

      expect(startNode).toBeDefined();
      expect(webhookNode).toBeDefined();
      expect(cronNode).toBeDefined();
    });

    it('should include transform nodes', () => {
      const nodeInfoList = NodeRegistry.getNodeInfoFull();

      const httpNode = nodeInfoList.find(n => n.type === 'HttpRequest');
      const setNode = nodeInfoList.find(n => n.type === 'Set');
      const codeNode = nodeInfoList.find(n => n.type === 'Code');

      expect(httpNode).toBeDefined();
      expect(setNode).toBeDefined();
      expect(codeNode).toBeDefined();
    });

    it('should include flow control nodes', () => {
      const nodeInfoList = NodeRegistry.getNodeInfoFull();

      const ifNode = nodeInfoList.find(n => n.type === 'If');
      const switchNode = nodeInfoList.find(n => n.type === 'Switch');
      const mergeNode = nodeInfoList.find(n => n.type === 'Merge');

      expect(ifNode).toBeDefined();
      expect(switchNode).toBeDefined();
      expect(mergeNode).toBeDefined();
    });

    it('should include AI nodes', () => {
      const nodeInfoList = NodeRegistry.getNodeInfoFull();

      const llmNode = nodeInfoList.find(n => n.type === 'LLMChat');
      const agentNode = nodeInfoList.find(n => n.type === 'AIAgent');

      expect(llmNode).toBeDefined();
      expect(agentNode).toBeDefined();
    });
  });

  describe('get specific node', () => {
    it('should get HttpRequest node with full schema', () => {
      const info = NodeRegistry.getNodeTypeInfo('HttpRequest');

      expect(info).toBeDefined();
      expect(info!.type).toBe('HttpRequest');
      expect(info!.displayName).toBe('HTTP Request');
      expect(info!.properties).toBeDefined();

      // Check for required properties
      const urlProp = info!.properties.find(p => p.name === 'url');
      const methodProp = info!.properties.find(p => p.name === 'method');

      expect(urlProp).toBeDefined();
      expect(methodProp).toBeDefined();
      expect(methodProp!.type).toBe('options');
    });

    it('should get Set node with field configuration properties', () => {
      const info = NodeRegistry.getNodeTypeInfo('Set');

      expect(info).toBeDefined();
      expect(info!.type).toBe('Set');

      const modeProp = info!.properties.find(p => p.name === 'mode');
      const fieldsProp = info!.properties.find(p => p.name === 'fields');

      expect(modeProp).toBeDefined();
      expect(fieldsProp).toBeDefined();
      expect(fieldsProp!.type).toBe('collection');
    });

    it('should get If node with true/false outputs', () => {
      const info = NodeRegistry.getNodeTypeInfo('If');

      expect(info).toBeDefined();
      expect(info!.type).toBe('If');
      expect(info!.outputs).toBeDefined();

      if (Array.isArray(info!.outputs)) {
        const trueOutput = info!.outputs.find(o => o.name === 'true');
        const falseOutput = info!.outputs.find(o => o.name === 'false');

        expect(trueOutput).toBeDefined();
        expect(falseOutput).toBeDefined();
      }
    });

    it('should get Switch node with dynamic outputs', () => {
      const info = NodeRegistry.getNodeTypeInfo('Switch');

      expect(info).toBeDefined();
      expect(info!.type).toBe('Switch');
      expect(info!.outputStrategy).toBeDefined();
      expect(info!.outputStrategy!.type).toBe('dynamicFromCollection');
    });

    it('should get Merge node with dynamic inputs', () => {
      const info = NodeRegistry.getNodeTypeInfo('Merge');

      expect(info).toBeDefined();
      expect(info!.type).toBe('Merge');
      expect(info!.inputCount).toBe('dynamic');
      expect(info!.inputStrategy).toBeDefined();
    });

    it('should get Code node with JavaScript code property', () => {
      const info = NodeRegistry.getNodeTypeInfo('Code');

      expect(info).toBeDefined();
      expect(info!.type).toBe('Code');

      const codeProp = info!.properties.find(p => p.name === 'code');
      expect(codeProp).toBeDefined();
      expect(codeProp!.typeOptions?.language).toBe('javascript');
    });

    it('should get LLMChat node with model and prompt properties', () => {
      const info = NodeRegistry.getNodeTypeInfo('LLMChat');

      expect(info).toBeDefined();
      expect(info!.type).toBe('LLMChat');

      const modelProp = info!.properties.find(p => p.name === 'model');
      const promptProp = info!.properties.find(p => p.name === 'userPrompt');

      expect(modelProp).toBeDefined();
      expect(promptProp).toBeDefined();
    });

    it('should get AIAgent node with tools property', () => {
      const info = NodeRegistry.getNodeTypeInfo('AIAgent');

      expect(info).toBeDefined();
      expect(info!.type).toBe('AIAgent');

      const toolsProp = info!.properties.find(p => p.name === 'tools');
      const maxIterProp = info!.properties.find(p => p.name === 'maxIterations');

      expect(toolsProp).toBeDefined();
      expect(maxIterProp).toBeDefined();
    });

    it('should return null for unknown node type', () => {
      const info = NodeRegistry.getNodeTypeInfo('NonExistentNode');

      expect(info).toBeNull();
    });
  });

  describe('node instance creation', () => {
    it('should create fresh node instance via get()', () => {
      const node = NodeRegistry.get('Start');

      expect(node).toBeDefined();
      expect(node.type).toBe('Start');
    });

    it('should throw error for unknown node type', () => {
      expect(() => NodeRegistry.get('NonExistentNode')).toThrow('Unknown node type');
    });

    it('should check if node type exists', () => {
      expect(NodeRegistry.has('HttpRequest')).toBe(true);
      expect(NodeRegistry.has('FakeNode')).toBe(false);
    });
  });
});
