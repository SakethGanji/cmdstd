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
  const isTrigger = node.data.type?.includes('Trigger') || node.data.type?.includes('trigger');

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Node Header */}
      <div className="flex items-center gap-4 border-b border-neutral-200 px-6 py-4">
        <div
          className={`
            flex h-12 w-12 items-center justify-center rounded-xl
            ${isTrigger ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}
          `}
        >
          <IconComponent size={24} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-neutral-800">
            {node.data.label}
          </h2>
          <p className="text-sm text-neutral-500">
            {node.data.description || 'Configure this node'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('parameters')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'parameters'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Parameters
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-neutral-500 hover:text-neutral-700'
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
            <div className="rounded-lg border border-neutral-200">
              <button
                onClick={() => toggleSection('main')}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-50"
              >
                <span className="font-medium text-neutral-700">
                  Main Parameters
                </span>
                {expandedSections.main ? (
                  <ChevronUp size={18} className="text-neutral-400" />
                ) : (
                  <ChevronDown size={18} className="text-neutral-400" />
                )}
              </button>
              {expandedSections.main && (
                <div className="border-t border-neutral-200 px-4 py-4">
                  {/* Example parameters based on node type */}
                  {node.data.type === 'httpRequest' && (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                          Method
                        </label>
                        <select className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option>GET</option>
                          <option>POST</option>
                          <option>PUT</option>
                          <option>DELETE</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                          URL
                        </label>
                        <input
                          type="text"
                          placeholder="https://api.example.com/endpoint"
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {node.data.type === 'code' && (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                          Language
                        </label>
                        <select className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option>JavaScript</option>
                          <option>Python</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                          Code
                        </label>
                        <textarea
                          rows={6}
                          placeholder="// Write your code here..."
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {node.data.type === 'if' && (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                          Condition
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Value 1"
                            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <select className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option>equals</option>
                            <option>not equals</option>
                            <option>greater than</option>
                            <option>less than</option>
                            <option>contains</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Value 2"
                            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Generic fallback for other node types */}
                  {!['httpRequest', 'code', 'if'].includes(node.data.type || '') && (
                    <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
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
            <div className="rounded-lg border border-neutral-200">
              <button
                onClick={() => toggleSection('options')}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-50"
              >
                <span className="font-medium text-neutral-700">Options</span>
                {expandedSections.options ? (
                  <ChevronUp size={18} className="text-neutral-400" />
                ) : (
                  <ChevronDown size={18} className="text-neutral-400" />
                )}
              </button>
              {expandedSections.options && (
                <div className="border-t border-neutral-200 px-4 py-4">
                  <div className="space-y-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-neutral-700">
                        Continue on fail
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-neutral-700">
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
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Node Name
              </label>
              <input
                type="text"
                defaultValue={node.data.label}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Notes
              </label>
              <textarea
                rows={3}
                placeholder="Add notes about this node..."
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-neutral-700">Disable this node</span>
            </label>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-neutral-200 px-6 py-4">
        <button
          onClick={onExecute}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-600"
        >
          <Play size={18} />
          Test step
        </button>
      </div>
    </div>
  );
}
