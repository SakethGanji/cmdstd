import { lazy, Suspense, useMemo } from 'react';
import { X, RotateCcw, MessageSquare, Sparkles, Monitor } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useUIModeStore } from '../../stores/uiModeStore';
import { useAIChatStore } from '../../stores/aiChatStore';
import { detectUINodes } from './detectUINodes';
import { ChatPanel } from './ChatPanel';
import { ChatInput } from './ChatInput';
import { HTMLPanel } from './HTMLPanel';
import { MarkdownPanel } from './MarkdownPanel';
import type { WorkflowNodeData } from '../../types/workflow';
import type { Node } from 'reactflow';
import type { SidePanelTab } from '../../stores/uiModeStore';

const AIChatSidePanel = lazy(() => import('../ai-chat/AIChatSidePanel'));

export default function UIPreviewSidePanel() {
  const nodes = useWorkflowStore((s) => s.nodes) as Node<WorkflowNodeData>[];
  const clearMessages = useUIModeStore((s) => s.clearMessages);
  const setPreviewOpen = useUIModeStore((s) => s.setPreviewOpen);
  const activeTab = useUIModeStore((s) => s.activeTab);
  const setActiveTab = useUIModeStore((s) => s.setActiveTab);
  const clearChatHistory = useAIChatStore((s) => s.clearHistory);

  const uiConfig = useMemo(() => detectUINodes(nodes), [nodes]);

  const tabs: { id: SidePanelTab; label: string; icon: typeof Sparkles }[] = [
    { id: 'ai', label: 'AI', icon: Sparkles },
    { id: 'test', label: 'Test', icon: Monitor },
  ];

  const handleReset = () => {
    if (activeTab === 'test') {
      clearMessages();
    } else {
      clearChatHistory();
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleReset}
            title="Reset"
          >
            <RotateCcw size={14} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setPreviewOpen(false)}
            title="Close panel"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'ai' ? (
        <Suspense fallback={<div className="flex-1" />}>
          <AIChatSidePanel />
        </Suspense>
      ) : (
        <TestInterfaceContent uiConfig={uiConfig} />
      )}
    </div>
  );
}

/**
 * Test Interface tab content (extracted from old UIPreviewSidePanel).
 */
function TestInterfaceContent({ uiConfig }: { uiConfig: ReturnType<typeof detectUINodes> }) {
  const hasChat = uiConfig.outputTypes.includes('chat');
  const hasHTML = uiConfig.outputTypes.includes('html');
  const hasMarkdown = uiConfig.outputTypes.includes('markdown');
  const hasAnyOutput = hasChat || hasHTML || hasMarkdown;

  // Empty state if no UI nodes configured
  if (!uiConfig.inputNode && uiConfig.outputNodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground max-w-[200px]">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No UI nodes</p>
          <p className="text-xs mt-1">
            Add a ChatInput node to enable the chat interface
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Output panels - stacked vertically */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {hasChat && <ChatPanel />}
        {hasMarkdown && <MarkdownPanel />}
        {hasHTML && <HTMLPanel />}
        {!hasAnyOutput && (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            No output nodes configured
          </div>
        )}
      </div>

      {/* Input area */}
      {uiConfig.inputType === 'chat' && (
        <div className="p-3 border-t">
          <ChatInput config={uiConfig} />
        </div>
      )}
      {!uiConfig.inputType && (
        <div className="p-3 border-t text-center text-xs text-muted-foreground">
          Add a ChatInput node to enable user input
        </div>
      )}
    </div>
  );
}
