import { useMemo, useEffect } from 'react';
import { MessageSquare, RotateCcw } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
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

export default function UIPreviewPanel() {
  const nodes = useWorkflowStore((s) => s.nodes) as Node<WorkflowNodeData>[];
  const clearMessages = useUIModeStore((s) => s.clearMessages);
  const addMessage = useUIModeStore((s) => s.addMessage);

  const uiConfig = useMemo(() => detectUINodes(nodes), [nodes]);

  // Dynamic layout based on output types
  const hasChat = uiConfig.outputTypes.includes('chat');
  const hasHTML = uiConfig.outputTypes.includes('html');
  const hasMarkdown = uiConfig.outputTypes.includes('markdown');

  // Add welcome message on mount if configured
  useEffect(() => {
    if (uiConfig.welcomeMessage) {
      addMessage({
        type: 'assistant',
        content: uiConfig.welcomeMessage,
      });
    }
  }, [uiConfig.welcomeMessage, addMessage]);


  // Show message if no UI nodes configured
  if (!uiConfig.inputNode && uiConfig.outputNodes.length === 0) {
    return (
      <div className="h-full pt-16 flex items-center justify-center bg-muted/30">
        <div className="text-center text-muted-foreground max-w-md">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No UI nodes configured</p>
          <p className="text-sm mt-2">
            Add UI nodes to your workflow to enable the test interface:
          </p>
          <ul className="text-sm mt-3 space-y-1">
            <li><strong>ChatInput</strong> - chat interface (auto-displays last node output)</li>
            <li><strong>HTMLDisplay</strong> - for rich HTML output</li>
            <li><strong>MarkdownDisplay</strong> - for formatted text</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full pt-16 bg-muted/30">
      <div className="h-full flex items-center justify-center p-4">
        <div className="w-full max-w-4xl h-full max-h-[800px] flex flex-col gap-4">
          {/* Header with reset button */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Test Interface</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={clearMessages}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>

          {/* Dynamic output panels */}
          <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
            {hasChat && (
              <div className={cn('flex-1 min-w-0', (hasHTML || hasMarkdown) && 'max-w-[50%]')}>
                <ChatPanel />
              </div>
            )}
            {hasHTML && (
              <div className={cn('flex-1 min-w-0', (hasChat || hasMarkdown) && 'max-w-[50%]')}>
                <HTMLPanel />
              </div>
            )}
            {hasMarkdown && (
              <div className={cn('flex-1 min-w-0', (hasChat || hasHTML) && 'max-w-[50%]')}>
                <MarkdownPanel />
              </div>
            )}
            {!hasChat && !hasHTML && !hasMarkdown && (
              <div className="flex-1 rounded-lg border bg-background flex items-center justify-center text-muted-foreground">
                No output nodes configured
              </div>
            )}
          </div>

          {/* Input area - based on input node type */}
          {uiConfig.inputType === 'chat' && <ChatInput config={uiConfig} />}
          {!uiConfig.inputType && (
            <div className="text-center text-sm text-muted-foreground">
              Add a ChatInput node to enable user input
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
