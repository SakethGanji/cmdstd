import { useState, useMemo, useCallback } from 'react';
import { Database, Code, ChevronDown, ChevronUp, Copy, Check, Settings } from 'lucide-react';
import type { NodeExecutionData } from '../../types/workflow';
import { useWorkflowStore } from '../../stores/workflowStore';
import { getAllUpstreamNodes, getExpressionBasePath } from '../../lib/graphUtils';
import { useNodeTypes } from '../../hooks/useNodeTypes';
import RunDataDisplay from './RunDataDisplay';
import SchemaDisplay from './SchemaDisplay';

interface InputPanelProps {
  nodeId: string;
  executionData: NodeExecutionData | null;
}

type DisplayMode = 'json' | 'schema';

// System variables that are always available
const SYSTEM_VARIABLES = [
  { path: '$itemIndex', description: 'Current item index in the loop' },
  { path: '$execution.id', description: 'Current execution ID' },
  { path: '$now', description: 'Current timestamp (ms)' },
  { path: '$today', description: "Today's date (ISO)" },
  { path: '$env.VARIABLE', description: 'Environment variable' },
];

export default function InputPanel({ nodeId, executionData }: InputPanelProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('schema');
  const [showSystemVars, setShowSystemVars] = useState(false);

  // Get edges and execution data from store to find upstream node's output
  const { edges, executionData: allExecutionData, nodes } = useWorkflowStore();

  // Get node type definitions from API
  const { data: nodeTypes } = useNodeTypes();

  // Get all upstream nodes
  const upstreamNodes = useMemo(
    () => getAllUpstreamNodes(nodeId, nodes, edges),
    [nodeId, nodes, edges]
  );

  // Find the immediate upstream node (default selection)
  const immediateUpstreamNode = useMemo(
    () => upstreamNodes.find((n) => n.isImmediate),
    [upstreamNodes]
  );

  // Selected node state (default to immediate upstream)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Determine which node is actually selected (use immediate if none selected)
  const effectiveSelectedNode = useMemo(() => {
    if (selectedNodeId) {
      return upstreamNodes.find((n) => n.id === selectedNodeId);
    }
    return immediateUpstreamNode;
  }, [selectedNodeId, upstreamNodes, immediateUpstreamNode]);

  // Get the React Flow node for the selected upstream node
  const selectedReactFlowNode = useMemo(() => {
    if (!effectiveSelectedNode) return null;
    return nodes.find((n) => n.id === effectiveSelectedNode.id);
  }, [effectiveSelectedNode, nodes]);

  // Get output schema from node type definition (for fallback when no execution data)
  // Node types are already in backend format
  const selectedNodeOutputSchema = useMemo(() => {
    if (!selectedReactFlowNode || !nodeTypes) return null;
    const nodeType = selectedReactFlowNode.data?.type;
    if (!nodeType) return null;
    const typeDef = nodeTypes.find((t) => t.type === nodeType);
    return typeDef?.outputs?.[0]?.schema || null;
  }, [selectedReactFlowNode, nodeTypes]);

  // Get data for the selected node
  const selectedNodeData = useMemo(() => {
    if (!effectiveSelectedNode) return null;

    // If this is the immediate node, first try the current node's input data
    if (effectiveSelectedNode.isImmediate) {
      if (executionData?.input?.items && executionData.input.items.length > 0) {
        return executionData.input;
      }
    }

    // Get the selected node's output data
    const nodeExecution = allExecutionData[effectiveSelectedNode.id];
    if (nodeExecution?.output?.items && nodeExecution.output.items.length > 0) {
      return nodeExecution.output;
    }

    return null;
  }, [effectiveSelectedNode, executionData, allExecutionData]);

  // Compute the base path for expressions
  const basePath = useMemo(() => {
    if (!effectiveSelectedNode) return '$json';
    return getExpressionBasePath(effectiveSelectedNode.name, effectiveSelectedNode.isImmediate);
  }, [effectiveSelectedNode]);

  const hasData = selectedNodeData?.items && selectedNodeData.items.length > 0;
  const hasSchema = selectedNodeOutputSchema && selectedNodeOutputSchema.properties;
  const itemCount = selectedNodeData?.items?.length ?? 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header with node selector and view toggle */}
      <div className="flex items-center justify-between border-b border-border bg-[var(--card-gradient)] px-4 py-3 gap-3">
        {/* Node selector dropdown */}
        <div className="flex-1 min-w-0">
          {upstreamNodes.length > 0 ? (
            <select
              value={effectiveSelectedNode?.id || ''}
              onChange={(e) => setSelectedNodeId(e.target.value || null)}
              className="w-full text-sm font-semibold bg-[var(--input)] border border-[var(--input-border)] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary truncate"
            >
              {upstreamNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label}
                  {node.isImmediate ? ' (input)' : ''}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-semibold text-foreground truncate block">
              No upstream nodes
            </span>
          )}
        </div>

        {/* Item count badge */}
        {hasData && (
          <span className="glass-badge flex-shrink-0">
            {itemCount} items
          </span>
        )}

        {/* Display mode toggle */}
        <div className="glass-toggle-group flex items-center flex-shrink-0">
          <button
            onClick={() => setDisplayMode('schema')}
            className={`rounded-lg p-2 transition-all ${
              displayMode === 'schema'
                ? 'bg-[var(--card-solid)] shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Schema view"
          >
            <Database size={14} />
          </button>
          <button
            onClick={() => setDisplayMode('json')}
            className={`rounded-lg p-2 transition-all ${
              displayMode === 'json'
                ? 'bg-[var(--card-solid)] shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="JSON view"
          >
            <Code size={14} />
          </button>
        </div>
      </div>

      {/* Expression path indicator */}
      {effectiveSelectedNode && (
        <div className="px-4 py-2 bg-primary/5 border-b border-border flex items-center justify-between">
          <code className="text-xs text-primary font-mono font-semibold">{basePath}</code>
          {!effectiveSelectedNode.isImmediate && (
            <span className="label-caps">from {effectiveSelectedNode.label}</span>
          )}
        </div>
      )}

      {/* Data display */}
      <div className="flex-1 overflow-auto p-3">
        {executionData?.status === 'running' ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : hasData ? (
          <RunDataDisplay
            data={selectedNodeData!.items}
            mode={displayMode}
            basePath={basePath}
          />
        ) : hasSchema ? (
          // Show output schema when no execution data yet
          <SchemaDisplay
            schema={selectedNodeOutputSchema}
            basePath={basePath}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Database size={24} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">
              {effectiveSelectedNode
                ? `No data from ${effectiveSelectedNode.label}`
                : upstreamNodes.length === 0
                  ? 'No connected input'
                  : 'Select a node to view data'}
            </p>
            {effectiveSelectedNode && (
              <p className="text-xs text-muted-foreground">
                Run workflow to see output data
              </p>
            )}
            {upstreamNodes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Connect a node to see its output here
              </p>
            )}
          </div>
        )}
      </div>

      {/* System Variables Section */}
      <div className="border-t border-border">
        <button
          onClick={() => setShowSystemVars(!showSystemVars)}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-muted-foreground" />
            <span className="label-caps">System Variables</span>
          </div>
          {showSystemVars ? (
            <ChevronUp size={14} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={14} className="text-muted-foreground" />
          )}
        </button>

        {showSystemVars && (
          <div className="px-3 pb-3">
            <div className="rounded-xl border border-border bg-[var(--card-solid)] overflow-hidden">
              {SYSTEM_VARIABLES.map((variable) => (
                <SystemVariableRow key={variable.path} {...variable} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// System variable row component
interface SystemVariableRowProps {
  path: string;
  description: string;
}

function SystemVariableRow({ path, description }: SystemVariableRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const expression = `{{ ${path} }}`;
    navigator.clipboard.writeText(expression);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [path]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', path);
      e.dataTransfer.setData('application/x-field-path', path);
      e.dataTransfer.effectAllowed = 'copy';
    },
    [path]
  );

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center justify-between border-b border-border last:border-b-0 hover:bg-accent/30 cursor-grab transition-colors group px-3 py-2.5"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <code className="text-xs font-mono font-semibold text-foreground">{path}</code>
        <span className="label-caps">{description}</span>
      </div>
      <button
        onClick={handleCopy}
        className="p-2 rounded-lg hover:bg-accent opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
        title={`Copy {{ ${path} }}`}
      >
        {copied ? (
          <Check size={14} className="text-[var(--success)]" />
        ) : (
          <Copy size={14} className="text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
