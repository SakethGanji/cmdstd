import { useState, useMemo, useCallback } from 'react';
import { Database, Code, ChevronDown, ChevronUp, Copy, Check, Settings, FileText } from 'lucide-react';
import type { NodeExecutionData } from '../../types/workflow';
import { useWorkflowStore } from '../../stores/workflowStore';
import { getAllUpstreamNodes, getExpressionBasePath } from '../../lib/graphUtils';
import { useNodeTypes, uiTypeToBackendType } from '../../hooks/useNodeTypes';
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
  const selectedNodeOutputSchema = useMemo(() => {
    if (!selectedReactFlowNode || !nodeTypes) return null;
    const nodeType = selectedReactFlowNode.data?.type;
    if (!nodeType) return null;
    const backendType = uiTypeToBackendType(nodeType);
    const typeDef = nodeTypes.find((t) => t.type === backendType);
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
    <div className="flex h-full flex-col bg-muted/50">
      {/* Header with node selector and view toggle */}
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2 gap-2">
        {/* Node selector dropdown */}
        <div className="flex-1 min-w-0">
          {upstreamNodes.length > 0 ? (
            <select
              value={effectiveSelectedNode?.id || ''}
              onChange={(e) => setSelectedNodeId(e.target.value || null)}
              className="w-full text-sm font-medium bg-muted border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring truncate"
            >
              {upstreamNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label}
                  {node.isImmediate ? ' (input)' : ''}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-medium text-foreground truncate block">
              No upstream nodes
            </span>
          )}
        </div>

        {/* Item count badge */}
        {hasData && (
          <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {itemCount}
          </span>
        )}

        {/* Display mode toggle */}
        <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5 flex-shrink-0">
          <button
            onClick={() => setDisplayMode('schema')}
            className={`rounded p-1 transition-colors ${
              displayMode === 'schema'
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Schema view"
          >
            <Database size={14} />
          </button>
          <button
            onClick={() => setDisplayMode('json')}
            className={`rounded p-1 transition-colors ${
              displayMode === 'json'
                ? 'bg-card shadow-sm text-foreground'
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
        <div className="px-3 py-1.5 bg-primary/5 border-b border-border flex items-center justify-between">
          <code className="text-xs text-primary font-mono">{basePath}</code>
          {!effectiveSelectedNode.isImmediate && (
            <span className="text-[10px] text-muted-foreground">from {effectiveSelectedNode.label}</span>
          )}
        </div>
      )}

      {/* Data display */}
      <div className="flex-1 overflow-auto p-2">
        {executionData?.status === 'running' ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
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
          <div className="flex h-full flex-col items-center justify-center text-center px-4">
            <Database size={32} className="mb-2 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {effectiveSelectedNode
                ? `No data from ${effectiveSelectedNode.label}`
                : upstreamNodes.length === 0
                  ? 'No connected input'
                  : 'Select a node to view data'}
            </p>
            {effectiveSelectedNode && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Run workflow to see output data
              </p>
            )}
            {upstreamNodes.length === 0 && (
              <p className="text-xs text-muted-foreground/60 mt-1">
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
          className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings size={12} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">System Variables</span>
          </div>
          {showSystemVars ? (
            <ChevronUp size={12} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={12} className="text-muted-foreground" />
          )}
        </button>

        {showSystemVars && (
          <div className="px-2 pb-2">
            <div className="rounded-md border border-border bg-card">
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
      className="flex items-center justify-between border-b border-border last:border-b-0 hover:bg-primary/5 cursor-grab transition-colors group px-2 py-1.5"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <code className="text-xs font-mono text-foreground">{path}</code>
        <span className="text-[10px] text-muted-foreground truncate">{description}</span>
      </div>
      <button
        onClick={handleCopy}
        className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        title={`Copy {{ ${path} }}`}
      >
        {copied ? (
          <Check size={12} className="text-emerald-500" />
        ) : (
          <Copy size={12} className="text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
