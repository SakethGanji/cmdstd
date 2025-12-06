import { useState } from 'react';
import { Database, Code, List, Pin, Clock } from 'lucide-react';
import type { NodeExecutionData } from '../../types/workflow';
import RunDataDisplay from './RunDataDisplay';

interface OutputPanelProps {
  nodeId: string; // Reserved for future use
  executionData: NodeExecutionData | null;
}

// nodeId is reserved for future features like pin data storage

type DisplayMode = 'table' | 'json' | 'schema';

export default function OutputPanel({ executionData }: OutputPanelProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('table');
  const [isPinned, setIsPinned] = useState(false);

  const hasData = executionData?.output?.items && executionData.output.items.length > 0;
  const hasError = executionData?.output?.error;

  // Calculate execution time
  const executionTime = executionData?.startTime && executionData?.endTime
    ? `${((executionData.endTime - executionData.startTime) / 1000).toFixed(2)}s`
    : null;

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-neutral-800">Output</h3>
          {hasData && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              {executionData?.output?.items.length} items
            </span>
          )}
          {hasError && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
              Error
            </span>
          )}
          {executionTime && (
            <span className="flex items-center gap-1 text-xs text-neutral-500">
              <Clock size={12} />
              {executionTime}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Pin button */}
          <button
            onClick={() => setIsPinned(!isPinned)}
            className={`rounded p-1.5 ${
              isPinned
                ? 'bg-amber-100 text-amber-600'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
            }`}
            title={isPinned ? 'Unpin data' : 'Pin data'}
          >
            <Pin size={16} />
          </button>

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
      </div>

      {/* Pinned indicator */}
      {isPinned && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          <Pin size={12} />
          This output data is pinned
        </div>
      )}

      {/* Data display */}
      <div className="flex-1 overflow-auto p-4">
        {!executionData ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Database size={48} className="mb-4 text-neutral-300" />
            <p className="text-sm font-medium text-neutral-600">
              No output data yet
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Execute the node to see output
            </p>
          </div>
        ) : executionData.status === 'running' ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-500" />
            <p className="mt-4 text-sm text-neutral-500">Executing node...</p>
          </div>
        ) : hasError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-medium text-red-800">Execution Error</p>
            <p className="mt-1 text-sm text-red-600">
              {executionData.output?.error}
            </p>
          </div>
        ) : hasData ? (
          <RunDataDisplay
            data={executionData.output!.items}
            mode={displayMode}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Database size={48} className="mb-4 text-neutral-300" />
            <p className="text-sm font-medium text-neutral-600">
              No output items
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
