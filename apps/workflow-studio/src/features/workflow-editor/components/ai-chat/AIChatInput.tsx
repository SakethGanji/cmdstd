import { useState, useRef, useCallback } from 'react';
import { Send, Square, Sparkles, HelpCircle, Bug } from 'lucide-react';

interface AIChatInputProps {
  onSend: (message: string, modeHint?: 'auto' | 'generate' | 'modify' | 'explain' | 'fix') => void;
  isStreaming: boolean;
  onCancel: () => void;
}

export function AIChatInput({ onSend, isStreaming, onCancel }: AIChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, isStreaming, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }
  };

  const quickActions = [
    { label: 'Generate', icon: Sparkles, hint: 'generate' as const, prompt: '' },
    { label: 'Explain', icon: HelpCircle, hint: 'explain' as const, prompt: 'Explain this workflow' },
    { label: 'Fix', icon: Bug, hint: 'fix' as const, prompt: 'Find and fix any issues in this workflow' },
  ];

  return (
    <div className="space-y-2">
      {/* Quick actions */}
      <div className="flex gap-1.5 flex-wrap">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => {
              if (action.prompt) {
                onSend(action.prompt, action.hint);
              }
            }}
            disabled={isStreaming || !action.prompt}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
          >
            <action.icon size={12} />
            {action.label}
          </button>
        ))}
      </div>

      {/* Text input */}
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Describe what you want to build..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {isStreaming ? (
          <button
            onClick={onCancel}
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shrink-0"
            title="Stop"
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim()}
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
            title="Send (Ctrl+Enter)"
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
