/**
 * Zustand store for AI Chat message state.
 * Panel open/size is managed by uiModeStore (shared tabbed panel).
 */

import { create } from 'zustand';
import type { AIChatMessage } from '../types/aiChat';

interface AIChatState {
  messages: AIChatMessage[];
  isStreaming: boolean;

  // Actions
  addMessage: (msg: Omit<AIChatMessage, 'id' | 'timestamp'>) => void;
  updateLastMessage: (update: Partial<Pick<AIChatMessage, 'content' | 'operations'>>) => void;
  setStreaming: (streaming: boolean) => void;
  clearHistory: () => void;
}

export const useAIChatStore = create<AIChatState>((set) => ({
  messages: [],
  isStreaming: false,

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id: `ai_msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date(),
        },
      ],
    })),

  updateLastMessage: (update) =>
    set((state) => {
      const msgs = [...state.messages];
      if (msgs.length === 0) return state;
      const last = msgs[msgs.length - 1];
      msgs[msgs.length - 1] = {
        ...last,
        ...(update.content !== undefined ? { content: last.content + update.content } : {}),
        ...(update.operations !== undefined ? { operations: update.operations } : {}),
      };
      return { messages: msgs };
    }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  clearHistory: () => set({ messages: [] }),
}));
