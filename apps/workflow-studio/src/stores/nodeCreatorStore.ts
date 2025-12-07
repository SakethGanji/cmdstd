import { create } from 'zustand';
import type { NodeCreatorView } from '../types/workflow';

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
