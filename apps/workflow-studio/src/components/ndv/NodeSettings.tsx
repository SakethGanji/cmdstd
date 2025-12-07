import { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Play,
  Info,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
  MousePointer,
  Clock,
  Webhook,
  Code,
  GitBranch,
  Route,
  GitMerge,
  Layers,
  Globe,
  Pen,
  Pencil,
  Check,
  X,
  MessageSquare,
  Bot,
  AlertTriangle,
  Loader2,
  Filter,
  Calendar,
} from 'lucide-react';
import type { Node } from 'reactflow';
import type { WorkflowNodeData } from '../../types/workflow';
import { useWorkflowStore } from '../../stores/workflowStore';
import DynamicNodeForm, { type NodeProperty } from './DynamicNodeForm';
import { useNodeTypes, uiTypeToBackendType } from '../../hooks/useNodeTypes';

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  'mouse-pointer': MousePointer,
  clock: Clock,
  webhook: Webhook,
  code: Code,
  filter: Filter,
  'git-branch': GitBranch,
  route: Route,
  'git-merge': GitMerge,
  layers: Layers,
  globe: Globe,
  pen: Pen,
  calendar: Calendar,
  'message-square': MessageSquare,
  bot: Bot,
  'alert-triangle': AlertTriangle,
};

interface NodeSettingsProps {
  node: Node<WorkflowNodeData>;
  onExecute: () => void;
}

export default function NodeSettings({ node, onExecute }: NodeSettingsProps) {
  const [activeTab, setActiveTab] = useState<'parameters' | 'settings'>('parameters');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    main: true,
    options: false,
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(node.data.label);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  // Fetch node type schema from API
  const { data: nodeTypes, isLoading: isLoadingSchema } = useNodeTypes();

  // Get the schema for this node type
  const backendType = uiTypeToBackendType(node.data.type || '');
  const nodeSchema = nodeTypes?.find((n) => n.type === backendType);

  const IconComponent = iconMap[node.data.icon || 'code'] || Code;

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Reset edited name when node changes
  useEffect(() => {
    setEditedName(node.data.label);
    setIsEditingName(false);
  }, [node.id, node.data.label]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSaveName = () => {
    if (editedName.trim()) {
      updateNodeData(node.id, { label: editedName.trim() });
    } else {
      setEditedName(node.data.label);
    }
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setEditedName(node.data.label);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Node Header with inline editing */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <IconComponent size={24} />
        </div>
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                ref={nameInputRef}
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={handleSaveName}
                className="flex-1 text-xl font-semibold text-foreground bg-secondary rounded-lg px-2 py-1 border border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleSaveName}
                className="p-1 rounded hover:bg-accent text-primary"
                title="Save"
              >
                <Check size={18} />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
                title="Cancel"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h2 className="text-xl font-semibold text-foreground truncate">
                {node.data.label}
              </h2>
              <button
                onClick={() => setIsEditingName(true)}
                className="p-1 rounded hover:bg-accent text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                title="Rename node"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
          <p className="text-sm text-muted-foreground truncate">
            {node.data.description || 'Configure this node'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('parameters')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'parameters'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Parameters
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings size={14} className="mr-1 inline" />
          Settings
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'parameters' ? (
          <div className="space-y-4">
            {/* Main Parameters Section */}
            <div className="rounded-lg border border-border">
              <button
                onClick={() => toggleSection('main')}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent"
              >
                <span className="font-medium text-foreground">
                  Main Parameters
                </span>
                {expandedSections.main ? (
                  <ChevronUp size={18} className="text-muted-foreground" />
                ) : (
                  <ChevronDown size={18} className="text-muted-foreground" />
                )}
              </button>
              {expandedSections.main && (
                <div className="border-t border-border px-4 py-4">
                  {/* Dynamic form based on node schema from API */}
                  {isLoadingSchema ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={24} className="animate-spin text-muted-foreground" />
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
                    />
                  ) : nodeSchema && nodeSchema.properties.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                      <Info size={16} />
                      <span>This node has no configurable parameters.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary">
                      <Info size={16} />
                      <span>
                        Unable to load parameters schema. Check API connection.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Options Section - Error Handling */}
            <div className="rounded-lg border border-border">
              <button
                onClick={() => toggleSection('options')}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent"
              >
                <span className="font-medium text-foreground">Error Handling</span>
                {expandedSections.options ? (
                  <ChevronUp size={18} className="text-muted-foreground" />
                ) : (
                  <ChevronDown size={18} className="text-muted-foreground" />
                )}
              </button>
              {expandedSections.options && (
                <div className="border-t border-border px-4 py-4">
                  <div className="space-y-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={node.data.continueOnFail || false}
                        onChange={(e) => {
                          updateNodeData(node.id, {
                            continueOnFail: e.target.checked,
                          });
                        }}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                      />
                      <div>
                        <span className="text-sm text-foreground">
                          Continue on fail
                        </span>
                        <p className="text-xs text-muted-foreground">
                          Continue workflow execution even if this node fails
                        </p>
                      </div>
                    </label>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={(node.data.retryOnFail || 0) > 0}
                          onChange={(e) => {
                            updateNodeData(node.id, {
                              retryOnFail: e.target.checked ? 3 : 0,
                            });
                          }}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                        />
                        <div>
                          <span className="text-sm text-foreground">
                            Retry on fail
                          </span>
                          <p className="text-xs text-muted-foreground">
                            Retry this node if it fails
                          </p>
                        </div>
                      </label>

                      {(node.data.retryOnFail || 0) > 0 && (
                        <div className="ml-6 space-y-3">
                          <div>
                            <label className="mb-1 block text-sm text-muted-foreground">
                              Number of retries (1-10)
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
                              className="w-24 rounded-lg border border-input bg-secondary px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm text-muted-foreground">
                              Delay between retries (ms)
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
                              className="w-32 rounded-lg border border-input bg-secondary px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
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
          <div className="space-y-4">
            {/* Node Settings */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Node Name (ID)
              </label>
              <input
                type="text"
                value={node.data.name || node.data.label}
                disabled
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This is the unique identifier used in connections. Edit the display name in the header above.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Notes
              </label>
              <textarea
                rows={3}
                placeholder="Add notes about this node..."
                className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={node.data.disabled || false}
                onChange={(e) => {
                  updateNodeData(node.id, { disabled: e.target.checked });
                }}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              <div>
                <span className="text-sm text-foreground">Disable this node</span>
                <p className="text-xs text-muted-foreground">
                  Disabled nodes are skipped during execution
                </p>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-6 py-4">
        <button
          onClick={onExecute}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Play size={18} />
          Test step
        </button>
      </div>
    </div>
  );
}

// Legacy form components removed - now using DynamicNodeForm with schema-driven generation
