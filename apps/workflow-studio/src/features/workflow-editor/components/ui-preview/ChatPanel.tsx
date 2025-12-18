import { useRef, useEffect } from 'react';
import { useUIModeStore } from '../../stores/uiModeStore';
import { ChatBubble } from './ChatBubble';
import { Loader2 } from 'lucide-react';

export function ChatPanel() {
  const messages = useUIModeStore((s) => s.messages);
  const isExecuting = useUIModeStore((s) => s.isExecuting);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full rounded-lg border bg-background">
      <div className="px-4 py-2 border-b">
        <h3 className="text-sm font-medium">Chat</h3>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Start a conversation...
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {isExecuting && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
