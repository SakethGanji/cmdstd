import { create } from 'zustand';

export interface UIMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  format?: 'text' | 'markdown';
}

interface UIModeState {
  // View mode
  mode: 'builder' | 'ui';

  // Chat state
  messages: UIMessage[];
  isExecuting: boolean;

  // HTML panel state
  htmlContent: string | null;

  // Actions
  setMode: (mode: 'builder' | 'ui') => void;
  addMessage: (message: Omit<UIMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setExecuting: (executing: boolean) => void;
  setHtmlContent: (html: string | null) => void;
  reset: () => void;
}

export const useUIModeStore = create<UIModeState>((set) => ({
  mode: 'builder',
  messages: [],
  isExecuting: false,
  htmlContent: null,

  setMode: (mode) => set({ mode }),

  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date(),
        },
      ],
    })),

  clearMessages: () => set({ messages: [], htmlContent: null }),

  setExecuting: (executing) => set({ isExecuting: executing }),

  setHtmlContent: (html) => set({ htmlContent: html }),

  reset: () =>
    set({
      mode: 'builder',
      messages: [],
      isExecuting: false,
      htmlContent: null,
    }),
}));
