/**
 * TestInputPanel - Panel for entering test input data before executing a workflow
 */

import { useState, useCallback, useEffect } from 'react';
import { Play, ChevronDown, FlaskConical, RotateCcw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import CodeEditor from '@/shared/components/ui/code-editor';
import { cn } from '@/shared/lib/utils';
import { useWorkflowStore } from '../stores/workflowStore';

interface TestInputPanelProps {
  onExecute: (inputData?: Record<string, unknown>) => void;
  isExecuting: boolean;
}

const DEFAULT_INPUT = `{
  "example": "value",
  "number": 123
}`;

const STORAGE_KEY_PREFIX = 'workflow-test-input-';

export default function TestInputPanel({ onExecute, isExecuting }: TestInputPanelProps) {
  const workflowId = useWorkflowStore((s) => s.workflowId);
  const workflowName = useWorkflowStore((s) => s.workflowName);

  // Use workflowId if saved, otherwise use workflowName as key
  const storageKey = `${STORAGE_KEY_PREFIX}${workflowId || workflowName || 'default'}`;

  const [isOpen, setIsOpen] = useState(false);
  const [inputJson, setInputJson] = useState(() => {
    // Load from localStorage on initial mount
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) return saved;
    }
    return DEFAULT_INPUT;
  });
  const [error, setError] = useState<string | null>(null);

  // Update localStorage when input changes
  useEffect(() => {
    if (typeof window !== 'undefined' && inputJson !== DEFAULT_INPUT) {
      localStorage.setItem(storageKey, inputJson);
    }
  }, [inputJson, storageKey]);

  // Load saved input when workflow changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setInputJson(saved);
      } else {
        setInputJson(DEFAULT_INPUT);
      }
    }
  }, [storageKey]);

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

  const handleReset = useCallback(() => {
    setInputJson(DEFAULT_INPUT);
    setError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={isExecuting}
          className={cn(
            'flex items-center gap-2 h-10 pl-4 pr-3 rounded-xl shadow-lg transition-all duration-200',
            'bg-[var(--success)] text-white hover:brightness-110',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          title="Run workflow"
        >
          <Play size={14} fill="currentColor" />
          <span className="text-sm font-semibold">Run</span>
          <ChevronDown size={14} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-[400px] p-0 overflow-hidden"
      >
        <div className="p-4 border-b border-border bg-[var(--card-gradient)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--success)]/10 flex items-center justify-center">
              <FlaskConical size={16} className="text-[var(--success)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Test Workflow</h3>
              <p className="text-xs text-muted-foreground">
                Enter JSON input to simulate webhook data
              </p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="label-caps">
              Input Data (JSON)
            </label>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Reset to default"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
          <div className="rounded-xl overflow-hidden border border-[var(--input-border)]">
            <CodeEditor
              value={inputJson}
              onChange={setInputJson}
              language="json"
              placeholder='{"key": "value"}'
              minHeight="120px"
              maxHeight="200px"
            />
          </div>
          {error && (
            <p className="text-xs text-destructive mt-2 font-medium">{error}</p>
          )}
        </div>

        <div className="p-4 pt-0 flex gap-3">
          <button
            onClick={handleRunWithoutInput}
            className={cn(
              'flex-1 h-10 px-4 rounded-xl text-sm font-semibold transition-all duration-200',
              'glass-button'
            )}
          >
            Run Empty
          </button>
          <button
            onClick={handleRunWithInput}
            className={cn(
              'flex-1 h-10 px-4 rounded-xl text-sm font-semibold transition-all duration-200',
              'bg-[var(--success)] text-white hover:brightness-110 shadow-md',
              'flex items-center justify-center gap-2'
            )}
          >
            <Play size={14} fill="currentColor" />
            Run with Input
          </button>
        </div>

        <div className="px-4 pb-4">
          <p className="text-xs text-muted-foreground">
            Access in nodes via: <code className="glass-badge text-[9px] px-2 py-0.5">{'{{ $json.body.key }}'}</code>
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
