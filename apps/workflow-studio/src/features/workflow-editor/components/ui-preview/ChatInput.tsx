import { useState, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useUIModeStore } from '../../stores/uiModeStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import { toBackendWorkflow } from '../../lib/workflowTransform';
import { backends } from '@/shared/lib/config';
import type { UIConfig } from './detectUINodes';
import type { Node, Edge } from 'reactflow';
import type { WorkflowNodeData } from '../../types/workflow';

interface ChatInputProps {
  config: UIConfig;
}

export function ChatInput({ config }: ChatInputProps) {
  const [input, setInput] = useState('');
  const workflowId = useWorkflowStore((s) => s.workflowId);
  const workflowName = useWorkflowStore((s) => s.workflowName);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const addMessage = useUIModeStore((s) => s.addMessage);
  const isExecuting = useUIModeStore((s) => s.isExecuting);
  const setIsExecuting = useUIModeStore((s) => s.setExecuting);
  const setHtmlContent = useUIModeStore((s) => s.setHtmlContent);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isExecuting) return;

    const message = input.trim();
    setInput('');

    // Add user message
    addMessage({ type: 'user', content: message });
    setIsExecuting(true);

    try {
      let response: Response;

      if (workflowId) {
        // Use saved workflow execution
        response = await fetch(`${backends.workflow}/api/workflows/${workflowId}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input_data: { message },
          }),
        });
      } else {
        // Use ad-hoc execution (no save required)
        const workflow = toBackendWorkflow(
          nodes as Node<WorkflowNodeData>[],
          edges as Edge[],
          workflowName || 'Untitled'
        );

        // Inject the user message into the workflow request
        response = await fetch(`${backends.workflow}/api/workflows/run-adhoc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...workflow,
            // Pass input data via a special field that the backend will use
            _input_data: { message },
          }),
        });
      }

      if (!response.ok) {
        throw new Error('Workflow execution failed');
      }

      const result = await response.json();

      // Process results - find ChatOutput and HTMLDisplay outputs
      if (result.data) {
        for (const [_nodeName, nodeData] of Object.entries(result.data)) {
          const items = nodeData as Array<{ json: Record<string, unknown> }>;
          if (!items || !items.length) continue;

          for (const item of items) {
            const data = item.json;

            // Handle chat output
            if (data._uiType === 'chat') {
              addMessage({
                type: (data._messageType as 'assistant' | 'system') || 'assistant',
                content: String(data.message || ''),
                format: data._format as 'text' | 'markdown',
              });
            }

            // Handle HTML output
            if (data._renderAs === 'html' || data.html) {
              setHtmlContent(String(data.html || ''));
            }
          }
        }
      }
    } catch (error) {
      console.error('Execution error:', error);
      addMessage({
        type: 'system',
        content: 'An error occurred while executing the workflow.',
      });
    } finally {
      setIsExecuting(false);
    }
  }, [input, workflowId, workflowName, nodes, edges, addMessage, setIsExecuting, setHtmlContent, isExecuting]);

  const placeholder = config.placeholder || 'Type a message...';

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder={placeholder}
        disabled={isExecuting}
        className="flex-1 rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
      />
      <Button
        onClick={handleSend}
        disabled={!input.trim() || isExecuting}
        size="icon"
        className="h-10 w-10"
      >
        {isExecuting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
