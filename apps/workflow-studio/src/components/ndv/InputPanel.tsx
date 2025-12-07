import { useState } from 'react';
import { Database, Code, List, ChevronDown } from 'lucide-react';
import type { NodeExecutionData } from '../../types/workflow';
import RunDataDisplay from './RunDataDisplay';

interface InputPanelProps {
  nodeId: string; // Reserved for future use
  executionData: NodeExecutionData | null;
}

// nodeId is reserved for selecting input from different source nodes

type DisplayMode = 'table' | 'json' | 'schema';

export default function InputPanel({ executionData }: InputPanelProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('table');

  const hasData = executionData?.input?.items && executionData.input.items.length > 0;

  return (
    <div className="flex h-full flex-col bg-muted">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Input</h3>
          {hasData && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {executionData?.input?.items.length} items
            </span>
          )}
        </div>

        {/* Display mode toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setDisplayMode('table')}
            className={`rounded p-1.5 ${
              displayMode === 'table'
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Table view"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setDisplayMode('json')}
            className={`rounded p-1.5 ${
              displayMode === 'json'
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="JSON view"
          >
            <Code size={16} />
          </button>
          <button
            onClick={() => setDisplayMode('schema')}
            className={`rounded p-1.5 ${
              displayMode === 'schema'
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Schema view"
          >
            <Database size={16} />
          </button>
        </div>
      </div>

      {/* Node selector (would allow selecting which input node to view) */}
      <div className="border-b border-border bg-card px-4 py-2">
        <button className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-accent">
          <span className="text-muted-foreground">Select input node...</span>
          <ChevronDown size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Data display */}
      <div className="flex-1 overflow-auto p-4">
        {!executionData ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Database size={48} className="mb-4 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              No input data
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Execute a previous node to see input data
            </p>
          </div>
        ) : executionData.status === 'running' ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : hasData ? (
          <RunDataDisplay
            data={executionData.input!.items}
            mode={displayMode}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Database size={48} className="mb-4 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              No input items
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
