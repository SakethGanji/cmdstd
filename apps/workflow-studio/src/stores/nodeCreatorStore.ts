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

/**
 * Node definitions - aligned with backend node types
 *
 * Key fields:
 * - type: UI type (camelCase) - used internally in UI
 * - backendType: Backend type (PascalCase) - used for API calls and name generation
 * - displayName: Shown in UI
 */

export const triggerNodes: NodeDefinition[] = [
  {
    type: 'manualTrigger',
    name: 'Start',  // Backend type - used for generating node names
    displayName: 'Manual Trigger',
    description: 'Runs the flow on clicking a button',
    icon: 'mouse-pointer',
    category: 'trigger',
  },
  {
    type: 'scheduleTrigger',
    name: 'Cron',
    displayName: 'Schedule Trigger',
    description: 'Runs the flow on a schedule (cron)',
    icon: 'clock',
    category: 'trigger',
  },
  {
    type: 'webhook',
    name: 'Webhook',
    displayName: 'Webhook',
    description: 'Runs the flow on receiving an HTTP request',
    icon: 'webhook',
    category: 'trigger',
  },
  {
    type: 'errorTrigger',
    name: 'ErrorTrigger',
    displayName: 'Error Trigger',
    description: 'Triggers when another workflow fails',
    icon: 'alert-triangle',
    category: 'trigger',
  },
];

export const regularNodes: NodeDefinition[] = [
  // Transform Data
  {
    type: 'set',
    name: 'Set',
    displayName: 'Set',
    description: 'Sets values on items and optionally remove other values',
    icon: 'pen',
    category: 'transform',
    subcategory: 'Transform Data',
  },
  {
    type: 'code',
    name: 'Code',
    displayName: 'Code',
    description: 'Run custom JavaScript code',
    icon: 'code',
    category: 'transform',
    subcategory: 'Transform Data',
  },
  // Note: Filter node removed - not implemented in backend
  // Flow Control
  {
    type: 'if',
    name: 'If',
    displayName: 'If',
    description: 'Route items based on conditions',
    icon: 'git-branch',
    category: 'flow',
    subcategory: 'Flow',
  },
  {
    type: 'switch',
    name: 'Switch',
    displayName: 'Switch',
    description: 'Route items based on multiple conditions',
    icon: 'route',
    category: 'flow',
    subcategory: 'Flow',
  },
  {
    type: 'merge',
    name: 'Merge',
    displayName: 'Merge',
    description: 'Merge data from multiple inputs',
    icon: 'git-merge',
    category: 'flow',
    subcategory: 'Flow',
  },
  {
    type: 'splitInBatches',
    name: 'SplitInBatches',
    displayName: 'Split In Batches',
    description: 'Split data into batches for processing',
    icon: 'layers',
    category: 'flow',
    subcategory: 'Flow',
  },
  // Helpers
  {
    type: 'httpRequest',
    name: 'HttpRequest',
    displayName: 'HTTP Request',
    description: 'Makes HTTP requests and returns the response',
    icon: 'globe',
    category: 'helper',
    subcategory: 'Helpers',
  },
  {
    type: 'wait',
    name: 'Wait',
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
