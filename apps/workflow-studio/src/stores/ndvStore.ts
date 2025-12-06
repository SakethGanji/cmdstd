import { create } from 'zustand';

interface NDVState {
  // Modal state
  isOpen: boolean;
  activeNodeId: string | null;

  // Panel sizes (percentage)
  inputPanelSize: number;
  outputPanelSize: number;

  // Display modes
  inputDisplayMode: 'table' | 'json' | 'schema';
  outputDisplayMode: 'table' | 'json' | 'schema';

  // Actions
  openNDV: (nodeId: string) => void;
  closeNDV: () => void;

  setPanelSizes: (input: number, output: number) => void;
  setInputDisplayMode: (mode: 'table' | 'json' | 'schema') => void;
  setOutputDisplayMode: (mode: 'table' | 'json' | 'schema') => void;
}

export const useNDVStore = create<NDVState>((set) => ({
  isOpen: false,
  activeNodeId: null,
  inputPanelSize: 25,
  outputPanelSize: 25,
  inputDisplayMode: 'table',
  outputDisplayMode: 'table',

  openNDV: (nodeId) => set({ isOpen: true, activeNodeId: nodeId }),
  closeNDV: () => set({ isOpen: false, activeNodeId: null }),

  setPanelSizes: (input, output) =>
    set({ inputPanelSize: input, outputPanelSize: output }),

  setInputDisplayMode: (mode) => set({ inputDisplayMode: mode }),
  setOutputDisplayMode: (mode) => set({ outputDisplayMode: mode }),
}));
