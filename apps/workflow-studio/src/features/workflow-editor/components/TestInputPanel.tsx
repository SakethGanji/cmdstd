/**
 * TestInputPanel - Panel for entering test input data before executing a workflow
 */

import { useState, useCallback } from 'react';
import { Play, ChevronDown, FlaskConical } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import CodeEditor from '@/shared/components/ui/code-editor';
import { cn } from '@/shared/lib/utils';

interface TestInputPanelProps {
  onExecute: (inputData?: Record<string, unknown>) => void;
  isExecuting: boolean;
}

const DEFAULT_INPUT = `{
  "example": "value",
  "number": 123
}`;

export default function TestInputPanel({ onExecute, isExecuting }: TestInputPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputJson, setInputJson] = useState(DEFAULT_INPUT);
  const [error, setError] = useState<string | null>(null);

  const handleRunWithInput = useCallback(() => {
    try {
      const parsed = JSON.parse(inputJson);
      setError(null);
      setIsOpen(false);
      onExecute(parsed);
    } catch (e) {
      setError('Invalid JSON: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  }, [inputJson, onExecute]);

  const handleRunWithoutInput = useCallback(() => {
    setIsOpen(false);
    onExecute();
  }, [onExecute]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={isExecuting}
          className={cn(
            'flex items-center gap-1 h-9 pl-3 pr-2 rounded-lg shadow-md transition-all',
            'bg-emerald-500 text-white hover:bg-emerald-600',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          title="Run workflow"
        >
          <Play size={14} fill="currentColor" />
          <span className="text-sm font-medium">Run</span>
          <ChevronDown size={14} className="ml-0.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-96 p-0"
      >
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FlaskConical size={16} className="text-muted-foreground" />
            Test Workflow
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Enter JSON input data to test your workflow. This simulates webhook body data.
          </p>
        </div>

        <div className="p-3">
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            Input Data (JSON)
          </label>
          <CodeEditor
            value={inputJson}
            onChange={setInputJson}
            language="json"
            placeholder='{"key": "value"}'
            minHeight="120px"
            maxHeight="200px"
          />
          {error && (
            <p className="text-xs text-destructive mt-2">{error}</p>
          )}
        </div>

        <div className="p-3 pt-0 flex gap-2">
          <button
            onClick={handleRunWithoutInput}
            className={cn(
              'flex-1 h-9 px-3 rounded-md text-sm font-medium transition-colors',
              'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            Run Empty
          </button>
          <button
            onClick={handleRunWithInput}
            className={cn(
              'flex-1 h-9 px-3 rounded-md text-sm font-medium transition-colors',
              'bg-emerald-500 text-white hover:bg-emerald-600',
              'flex items-center justify-center gap-1.5'
            )}
          >
            <Play size={14} fill="currentColor" />
            Run with Input
          </button>
        </div>

        <div className="px-3 pb-3">
          <p className="text-xs text-muted-foreground">
            Access in nodes via: <code className="bg-muted px-1 rounded">{'{{ $json.body.key }}'}</code>
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
