import { create } from 'zustand';
import type { NodeCreatorView, NodeDefinition } from '../types/workflow';

interface NodeCreatorState {
  // Panel state
  isOpen: boolean;
  view: NodeCreatorView;
  search: string;

  // Connection context - when adding node from existing node's handle
  sourceNodeId: string | null;
  sourceHandleId: string | null;

  // Actions
  openPanel: (view: NodeCreatorView) => void;
  closePanel: () => void;
  setView: (view: NodeCreatorView) => void;
  setSearch: (search: string) => void;

  // Open with connection context (from + button on node)
  openForConnection: (sourceNodeId: string, sourceHandleId: string) => void;
  clearConnectionContext: () => void;
}

export const useNodeCreatorStore = create<NodeCreatorState>((set) => ({
  isOpen: false,
  view: 'trigger',
  search: '',
  sourceNodeId: null,
  sourceHandleId: null,

  openPanel: (view) => set({ isOpen: true, view, search: '' }),
  closePanel: () => set({
    isOpen: false,
    search: '',
    sourceNodeId: null,
    sourceHandleId: null,
  }),
  setView: (view) => set({ view, search: '' }),
  setSearch: (search) => set({ search }),

  openForConnection: (sourceNodeId, sourceHandleId) =>
    set({
      isOpen: true,
      view: 'regular',
      search: '',
      sourceNodeId,
      sourceHandleId,
    }),

  clearConnectionContext: () =>
    set({ sourceNodeId: null, sourceHandleId: null }),
}));

// Node definitions - these would come from the backend in a real app
export const triggerNodes: NodeDefinition[] = [
  {
    type: 'manualTrigger',
    name: 'n8n-nodes-base.manualTrigger',
    displayName: 'Manual Trigger',
    description: 'Runs the flow on clicking a button in n8n',
    icon: 'mouse-pointer',
    category: 'trigger',
  },
  {
    type: 'scheduleTrigger',
    name: 'n8n-nodes-base.scheduleTrigger',
    displayName: 'Schedule Trigger',
    description: 'Runs the flow every day, hour, or custom interval',
    icon: 'clock',
    category: 'trigger',
  },
  {
    type: 'webhook',
    name: 'n8n-nodes-base.webhook',
    displayName: 'Webhook',
    description: 'Runs the flow on receiving an HTTP request',
    icon: 'webhook',
    category: 'trigger',
  },
  {
    type: 'cronTrigger',
    name: 'n8n-nodes-base.cron',
    displayName: 'Cron',
    description: 'Triggers workflow based on cron expression',
    icon: 'calendar',
    category: 'trigger',
  },
];

export const regularNodes: NodeDefinition[] = [
  // Transform Data
  {
    type: 'set',
    name: 'n8n-nodes-base.set',
    displayName: 'Set',
    description: 'Sets values on items and optionally remove other values',
    icon: 'pen',
    category: 'transform',
    subcategory: 'Transform Data',
  },
  {
    type: 'code',
    name: 'n8n-nodes-base.code',
    displayName: 'Code',
    description: 'Run custom JavaScript code',
    icon: 'code',
    category: 'transform',
    subcategory: 'Transform Data',
  },
  {
    type: 'filter',
    name: 'n8n-nodes-base.filter',
    displayName: 'Filter',
    description: 'Filter items based on conditions',
    icon: 'filter',
    category: 'transform',
    subcategory: 'Transform Data',
  },
  // Flow Control
  {
    type: 'if',
    name: 'n8n-nodes-base.if',
    displayName: 'If',
    description: 'Route items based on conditions',
    icon: 'git-branch',
    category: 'flow',
    subcategory: 'Flow',
  },
  {
    type: 'switch',
    name: 'n8n-nodes-base.switch',
    displayName: 'Switch',
    description: 'Route items based on multiple conditions',
    icon: 'route',
    category: 'flow',
    subcategory: 'Flow',
  },
  {
    type: 'merge',
    name: 'n8n-nodes-base.merge',
    displayName: 'Merge',
    description: 'Merge data from multiple inputs',
    icon: 'git-merge',
    category: 'flow',
    subcategory: 'Flow',
  },
  {
    type: 'splitInBatches',
    name: 'n8n-nodes-base.splitInBatches',
    displayName: 'Split In Batches',
    description: 'Split data into batches for processing',
    icon: 'layers',
    category: 'flow',
    subcategory: 'Flow',
  },
  // Helpers
  {
    type: 'httpRequest',
    name: 'n8n-nodes-base.httpRequest',
    displayName: 'HTTP Request',
    description: 'Makes HTTP requests and returns the response',
    icon: 'globe',
    category: 'helper',
    subcategory: 'Helpers',
  },
  {
    type: 'wait',
    name: 'n8n-nodes-base.wait',
    displayName: 'Wait',
    description: 'Wait for a specified amount of time',
    icon: 'clock',
    category: 'helper',
    subcategory: 'Helpers',
  },
];

// Helper to get nodes by category
export function getNodesByCategory(nodes: NodeDefinition[]) {
  const grouped: Record<string, NodeDefinition[]> = {};

  nodes.forEach((node) => {
    const key = node.subcategory || node.category;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(node);
  });

  return grouped;
}
