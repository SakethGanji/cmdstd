import { useAIChatStore } from '../../stores/aiChatStore';
import { useAIChat } from '../../hooks/useAIChat';
import { AIChatMessageList } from './AIChatMessageList';
import { AIChatInput } from './AIChatInput';

/**
 * AI Chat tab content — rendered inside the shared side panel.
 */
export default function AIChatSidePanel() {
  const messages = useAIChatStore((s) => s.messages);
  const { sendMessage, isStreaming, cancelStream } = useAIChat();

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Messages */}
      <AIChatMessageList messages={messages} isStreaming={isStreaming} />

      {/* Input */}
      <div className="p-3 border-t">
        <AIChatInput
          onSend={sendMessage}
          isStreaming={isStreaming}
          onCancel={cancelStream}
        />
      </div>
    </div>
  );
}
