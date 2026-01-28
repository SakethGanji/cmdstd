import { useMemo } from 'react';
import { X, RotateCcw, MessageSquare } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useUIModeStore } from '../../stores/uiModeStore';
import { detectUINodes } from './detectUINodes';
import { ChatPanel } from './ChatPanel';
import { ChatInput } from './ChatInput';
import { HTMLPanel } from './HTMLPanel';
import { MarkdownPanel } from './MarkdownPanel';
import type { WorkflowNodeData } from '../../types/workflow';
import type { Node } from 'reactflow';

export default function UIPreviewSidePanel() {
  const nodes = useWorkflowStore((s) => s.nodes) as Node<WorkflowNodeData>[];
  const clearMessages = useUIModeStore((s) => s.clearMessages);
  const setPreviewOpen = useUIModeStore((s) => s.setPreviewOpen);

  const uiConfig = useMemo(() => detectUINodes(nodes), [nodes]);

  // Dynamic layout based on output types
  const hasChat = uiConfig.outputTypes.includes('chat');
  const hasHTML = uiConfig.outputTypes.includes('html');
  const hasMarkdown = uiConfig.outputTypes.includes('markdown');
  const hasAnyOutput = hasChat || hasHTML || hasMarkdown;

  // Show helpful state if no UI nodes configured
  if (!uiConfig.inputNode && uiConfig.outputNodes.length === 0) {
    return (
      <div className="h-full flex flex-col border-l bg-background pt-14">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h2 className="text-sm font-medium">Test Interface</h2>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setPreviewOpen(false)}
          >
            <X size={14} />
          </Button>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-muted-foreground max-w-[200px]">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No UI nodes</p>
            <p className="text-xs mt-1">
              Add a ChatInput node to enable the chat interface
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-l bg-background pt-14">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h2 className="text-sm font-medium">Test Interface</h2>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={clearMessages}
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

      {/* Content */}
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
    </div>
  );
}
