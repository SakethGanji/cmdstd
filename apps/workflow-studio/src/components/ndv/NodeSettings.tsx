import { useState } from 'react';
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
  Filter,
  GitBranch,
  Route,
  GitMerge,
  Layers,
  Globe,
  Pen,
  Calendar,
} from 'lucide-react';
import type { Node } from 'reactflow';
import type { WorkflowNodeData } from '../../types/workflow';

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

  const IconComponent = iconMap[node.data.icon || 'code'] || Code;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Node Header */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <IconComponent size={24} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {node.data.label}
          </h2>
          <p className="text-sm text-muted-foreground">
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
                  {/* Example parameters based on node type */}
                  {node.data.type === 'httpRequest' && (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">
                          Method
                        </label>
                        <select className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring">
                          <option>GET</option>
                          <option>POST</option>
                          <option>PUT</option>
                          <option>DELETE</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">
                          URL
                        </label>
                        <input
                          type="text"
                          placeholder="https://api.example.com/endpoint"
                          className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                  )}

                  {node.data.type === 'code' && (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">
                          Language
                        </label>
                        <select className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring">
                          <option>JavaScript</option>
                          <option>Python</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">
                          Code
                        </label>
                        <textarea
                          rows={6}
                          placeholder="// Write your code here..."
                          className="w-full rounded-lg border border-input bg-secondary px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                  )}

                  {node.data.type === 'if' && (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">
                          Condition
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Value 1"
                            className="flex-1 rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          <select className="rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring">
                            <option>equals</option>
                            <option>not equals</option>
                            <option>greater than</option>
                            <option>less than</option>
                            <option>contains</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Value 2"
                            className="flex-1 rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Generic fallback for other node types */}
                  {!['httpRequest', 'code', 'if'].includes(node.data.type || '') && (
                    <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary">
                      <Info size={16} />
                      <span>
                        Parameters for this node type will be available in a future update.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Options Section */}
            <div className="rounded-lg border border-border">
              <button
                onClick={() => toggleSection('options')}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent"
              >
                <span className="font-medium text-foreground">Options</span>
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
                        className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                      />
                      <span className="text-sm text-foreground">
                        Continue on fail
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                      />
                      <span className="text-sm text-foreground">
                        Retry on fail
                      </span>
                    </label>
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
                Node Name
              </label>
              <input
                type="text"
                defaultValue={node.data.label}
                className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
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
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              <span className="text-sm text-foreground">Disable this node</span>
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
