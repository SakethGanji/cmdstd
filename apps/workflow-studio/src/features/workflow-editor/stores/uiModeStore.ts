import { create } from 'zustand';

export interface UIMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  format?: 'text' | 'markdown';
}

// localStorage keys
const PREVIEW_OPEN_KEY = 'workflow-studio:preview-open';
const PREVIEW_SIZE_KEY = 'workflow-studio:preview-size';

// Load persisted state
const getPersistedPreviewOpen = (): boolean => {
  try {
    const stored = localStorage.getItem(PREVIEW_OPEN_KEY);
    return stored ? JSON.parse(stored) : false;
  } catch {
    return false;
  }
};

const getPersistedPreviewSize = (): number => {
  try {
    const stored = localStorage.getItem(PREVIEW_SIZE_KEY);
    return stored ? JSON.parse(stored) : 35;
  } catch {
    return 35;
  }
};

interface UIModeState {
  // View mode (kept for backward compatibility)
  mode: 'builder' | 'ui';

  // Side panel state (new)
  isPreviewOpen: boolean;
  previewPanelSize: number;

  // Chat state
  messages: UIMessage[];
  isExecuting: boolean;

  // HTML panel state
  htmlContent: string | null;

  // Markdown panel state
  markdownContent: string | null;

  // Actions
  setMode: (mode: 'builder' | 'ui') => void;
  togglePreview: () => void;
  setPreviewOpen: (open: boolean) => void;
  setPreviewPanelSize: (size: number) => void;
  addMessage: (message: Omit<UIMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setExecuting: (executing: boolean) => void;
  setHtmlContent: (html: string | null) => void;
  setMarkdownContent: (markdown: string | null) => void;
  reset: () => void;
}

export const useUIModeStore = create<UIModeState>((set) => ({
  mode: 'builder',
  isPreviewOpen: getPersistedPreviewOpen(),
  previewPanelSize: getPersistedPreviewSize(),
  messages: [],
  isExecuting: false,
  htmlContent: null,
  markdownContent: null,

  setMode: (mode) => set({ mode }),

  togglePreview: () =>
    set((state) => {
      const newValue = !state.isPreviewOpen;
      localStorage.setItem(PREVIEW_OPEN_KEY, JSON.stringify(newValue));
      return { isPreviewOpen: newValue };
    }),

  setPreviewOpen: (open) => {
    localStorage.setItem(PREVIEW_OPEN_KEY, JSON.stringify(open));
    set({ isPreviewOpen: open });
  },

  setPreviewPanelSize: (size) => {
    localStorage.setItem(PREVIEW_SIZE_KEY, JSON.stringify(size));
    set({ previewPanelSize: size });
  },

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

  clearMessages: () => set({ messages: [], htmlContent: null, markdownContent: null }),

  setExecuting: (executing) => set({ isExecuting: executing }),

  setHtmlContent: (html) => set({ htmlContent: html }),

  setMarkdownContent: (markdown) => set({ markdownContent: markdown }),

  reset: () =>
    set({
      mode: 'builder',
      isPreviewOpen: false,
      messages: [],
      isExecuting: false,
      htmlContent: null,
      markdownContent: null,
    }),
}));
