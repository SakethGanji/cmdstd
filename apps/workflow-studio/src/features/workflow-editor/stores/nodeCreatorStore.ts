import { create } from 'zustand';
import type { NodeCreatorView, SubnodeSlotContext, SubnodeType } from '../types/workflow';

interface NodeCreatorState {
  // Panel state
  isOpen: boolean;
  view: NodeCreatorView;
  search: string;

  // Connection context - when adding node from existing node's handle
  sourceNodeId: string | null;
  sourceHandleId: string | null;

  // Subnode slot context - when adding subnode to a parent's slot
  subnodeSlotContext: SubnodeSlotContext | null;

  // Actions
  openPanel: (view: NodeCreatorView) => void;
  closePanel: () => void;
  setView: (view: NodeCreatorView) => void;
  setSearch: (search: string) => void;

  // Open with connection context (from + button on node)
  openForConnection: (sourceNodeId: string, sourceHandleId: string) => void;
  clearConnectionContext: () => void;

  // Open for subnode selection (from slot + button on parent node)
  openForSubnode: (parentNodeId: string, slotName: string, slotType: SubnodeType) => void;
  clearSubnodeContext: () => void;
}

export const useNodeCreatorStore = create<NodeCreatorState>((set) => ({
  isOpen: false,
  view: 'trigger',
  search: '',
  sourceNodeId: null,
  sourceHandleId: null,
  subnodeSlotContext: null,

  openPanel: (view) => set({ isOpen: true, view, search: '' }),
  closePanel: () => set({
    isOpen: false,
    search: '',
    sourceNodeId: null,
    sourceHandleId: null,
    subnodeSlotContext: null,
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
      subnodeSlotContext: null,
    }),

  clearConnectionContext: () =>
    set({ sourceNodeId: null, sourceHandleId: null }),

  openForSubnode: (parentNodeId, slotName, slotType) =>
    set({
      isOpen: true,
      view: 'subnode',
      search: '',
      sourceNodeId: null,
      sourceHandleId: null,
      subnodeSlotContext: {
        parentNodeId,
        slotName,
        slotType,
      },
    }),

  clearSubnodeContext: () =>
    set({ subnodeSlotContext: null }),
}));
