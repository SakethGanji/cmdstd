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
    <div className="flex h-full flex-col bg-neutral-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-neutral-800">Input</h3>
          {hasData && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
              {executionData?.input?.items.length} items
            </span>
          )}
        </div>

        {/* Display mode toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
          <button
            onClick={() => setDisplayMode('table')}
            className={`rounded p-1.5 ${
              displayMode === 'table'
                ? 'bg-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
            title="Table view"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setDisplayMode('json')}
            className={`rounded p-1.5 ${
              displayMode === 'json'
                ? 'bg-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
            title="JSON view"
          >
            <Code size={16} />
          </button>
          <button
            onClick={() => setDisplayMode('schema')}
            className={`rounded p-1.5 ${
              displayMode === 'schema'
                ? 'bg-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
            title="Schema view"
          >
            <Database size={16} />
          </button>
        </div>
      </div>

      {/* Node selector (would allow selecting which input node to view) */}
      <div className="border-b border-neutral-200 bg-white px-4 py-2">
        <button className="flex w-full items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm hover:bg-neutral-50">
          <span className="text-neutral-600">Select input node...</span>
          <ChevronDown size={16} className="text-neutral-400" />
        </button>
      </div>

      {/* Data display */}
      <div className="flex-1 overflow-auto p-4">
        {!executionData ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Database size={48} className="mb-4 text-neutral-300" />
            <p className="text-sm font-medium text-neutral-600">
              No input data
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Execute a previous node to see input data
            </p>
          </div>
        ) : executionData.status === 'running' ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-500" />
          </div>
        ) : hasData ? (
          <RunDataDisplay
            data={executionData.input!.items}
            mode={displayMode}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Database size={48} className="mb-4 text-neutral-300" />
            <p className="text-sm font-medium text-neutral-600">
              No input items
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
