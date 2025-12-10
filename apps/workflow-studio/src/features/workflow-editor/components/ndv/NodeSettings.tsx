import { useState, useMemo } from 'react';
import {
  Settings,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import type { Node } from 'reactflow';
import type { WorkflowNodeData } from '../../types/workflow';
import { useWorkflowStore } from '../../stores/workflowStore';
import DynamicNodeForm, { type NodeProperty, type OutputSchema } from './DynamicNodeForm';
import { useNodeTypes, uiTypeToBackendType } from '../../hooks/useNodeTypes';

interface NodeSettingsProps {
  node: Node<WorkflowNodeData>;
  onExecute: () => void;
}

export default function NodeSettings({ node }: NodeSettingsProps) {
  const [activeTab, setActiveTab] = useState<'parameters' | 'settings'>('parameters');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    main: true,
    options: false,
  });
  const { updateNodeData, edges, nodes, executionData } = useWorkflowStore((s) => ({
    updateNodeData: s.updateNodeData,
    edges: s.edges,
    nodes: s.nodes,
    executionData: s.executionData,
  }));

  // Fetch node type schema from API
  const { data: nodeTypes, isLoading: isLoadingSchema } = useNodeTypes();

  // Get the schema for this node type
  const backendType = uiTypeToBackendType(node.data.type || '');
  const nodeSchema = nodeTypes?.find((n) => n.type === backendType);

  // Find upstream node(s) connected to this node's input
  const upstreamNodeId = edges.find((e) => e.target === node.id)?.source;
  const upstreamNode = upstreamNodeId ? nodes.find((n) => n.id === upstreamNodeId) : null;
  const upstreamBackendType = upstreamNode?.data?.type
    ? uiTypeToBackendType(upstreamNode.data.type)
    : null;
  const upstreamNodeSchema = upstreamBackendType
    ? nodeTypes?.find((n) => n.type === upstreamBackendType)
    : null;

  // Get the output schema from the upstream node's first output
  const upstreamOutputSchema = upstreamNodeSchema?.outputs?.[0]?.schema as OutputSchema | undefined;

  // Get sample data from upstream node's execution output
  const upstreamSampleData = useMemo(() => {
    if (!upstreamNodeId) return undefined;
    const upstreamExecution = executionData[upstreamNodeId];
    if (!upstreamExecution?.output?.items) return undefined;
    return upstreamExecution.output.items as Record<string, unknown>[];
  }, [upstreamNodeId, executionData]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Compact Tabs - No duplicate header */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('parameters')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'parameters'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Parameters
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings size={12} className="mr-1 inline" />
          Settings
        </button>
      </div>

      {/* Content - tighter padding */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'parameters' ? (
          <div className="space-y-3">
            {/* Main Parameters Section */}
            <div className="rounded-md border border-border">
              <button
                onClick={() => toggleSection('main')}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent transition-colors"
              >
                <span className="text-sm font-medium text-foreground">
                  Main Parameters
                </span>
                {expandedSections.main ? (
                  <ChevronUp size={14} className="text-muted-foreground" />
                ) : (
                  <ChevronDown size={14} className="text-muted-foreground" />
                )}
              </button>
              {expandedSections.main && (
                <div className="border-t border-border px-3 py-3">
                  {/* Dynamic form based on node schema from API */}
                  {isLoadingSchema ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 size={20} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : nodeSchema && nodeSchema.properties.length > 0 ? (
                    <DynamicNodeForm
                      properties={nodeSchema.properties as NodeProperty[]}
                      values={(node.data.parameters as Record<string, unknown>) || {}}
                      onChange={(key, value) => {
                        updateNodeData(node.id, {
                          parameters: { ...node.data.parameters, [key]: value },
                        });
                      }}
                      allValues={(node.data.parameters as Record<string, unknown>) || {}}
                      upstreamSchema={upstreamOutputSchema}
                      sampleData={upstreamSampleData}
                    />
                  ) : nodeSchema && nodeSchema.properties.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                      <Info size={14} />
                      <span>No configurable parameters.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">
                      <Info size={14} />
                      <span>Unable to load schema.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Options Section - Error Handling */}
            <div className="rounded-md border border-border">
              <button
                onClick={() => toggleSection('options')}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent transition-colors"
              >
                <span className="text-sm font-medium text-foreground">Error Handling</span>
                {expandedSections.options ? (
                  <ChevronUp size={14} className="text-muted-foreground" />
                ) : (
                  <ChevronDown size={14} className="text-muted-foreground" />
                )}
              </button>
              {expandedSections.options && (
                <div className="border-t border-border px-3 py-3">
                  <div className="space-y-3">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={node.data.continueOnFail || false}
                        onChange={(e) => {
                          updateNodeData(node.id, {
                            continueOnFail: e.target.checked,
                          });
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring"
                      />
                      <div>
                        <span className="text-sm text-foreground">Continue on fail</span>
                        <p className="text-xs text-muted-foreground">
                          Continue even if this node fails
                        </p>
                      </div>
                    </label>

                    <div className="space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(node.data.retryOnFail || 0) > 0}
                          onChange={(e) => {
                            updateNodeData(node.id, {
                              retryOnFail: e.target.checked ? 3 : 0,
                            });
                          }}
                          className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring"
                        />
                        <div>
                          <span className="text-sm text-foreground">Retry on fail</span>
                          <p className="text-xs text-muted-foreground">Retry if it fails</p>
                        </div>
                      </label>

                      {(node.data.retryOnFail || 0) > 0 && (
                        <div className="ml-6 flex flex-wrap gap-3">
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">
                              Retries
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={node.data.retryOnFail || 3}
                              onChange={(e) => {
                                const val = Math.min(10, Math.max(1, parseInt(e.target.value) || 1));
                                updateNodeData(node.id, { retryOnFail: val });
                              }}
                              className="w-16 rounded-md border border-input bg-secondary px-2 py-1 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">
                              Delay (ms)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={100}
                              value={node.data.retryDelay || 1000}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 1000);
                                updateNodeData(node.id, { retryDelay: val });
                              }}
                              className="w-24 rounded-md border border-input bg-secondary px-2 py-1 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Node Settings */}
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Node ID
              </label>
              <input
                type="text"
                value={node.data.name || node.data.label}
                disabled
                className="w-full rounded-md border border-input bg-muted px-2 py-1.5 text-sm text-muted-foreground cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Unique identifier. Edit name in header.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Notes
              </label>
              <textarea
                rows={2}
                placeholder="Add notes..."
                className="w-full rounded-md border border-input bg-secondary px-2 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={node.data.disabled || false}
                onChange={(e) => {
                  updateNodeData(node.id, { disabled: e.target.checked });
                }}
                className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              <div>
                <span className="text-sm text-foreground">Disable node</span>
                <p className="text-xs text-muted-foreground">
                  Skipped during execution
                </p>
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
