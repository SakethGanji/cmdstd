import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import {
  Plus,
  Play,
  MoreHorizontal,
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
import { useNodeCreatorStore } from '../../../stores/nodeCreatorStore';
import { useNDVStore } from '../../../stores/ndvStore';
import { useWorkflowStore } from '../../../stores/workflowStore';
import type { WorkflowNodeData } from '../../../types/workflow';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
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

function WorkflowNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const [isHovered, setIsHovered] = useState(false);
  const openForConnection = useNodeCreatorStore((s) => s.openForConnection);
  const openNDV = useNDVStore((s) => s.openNDV);
  const executionData = useWorkflowStore((s) => s.executionData[id]);

  const IconComponent = iconMap[data.icon || 'code'] || Code;
  const isTrigger = data.type?.includes('Trigger') || data.type?.includes('trigger');

  // Show actions when hovered OR selected
  const showActions = isHovered || selected;

  const handleAddNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    openForConnection(id, 'source');
  };

  const handleDoubleClick = () => {
    openNDV(id);
  };

  const getStatusColor = () => {
    if (!executionData) return 'bg-neutral-100';
    switch (executionData.status) {
      case 'running':
        return 'bg-yellow-100 border-yellow-400';
      case 'success':
        return 'bg-green-100 border-green-400';
      case 'error':
        return 'bg-red-100 border-red-400';
      default:
        return 'bg-neutral-100';
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
    <div
      className={`
        relative flex min-w-[150px] cursor-grab flex-col rounded-lg border-2 bg-white shadow-md transition-all
        ${selected ? 'border-blue-500 shadow-lg' : 'border-neutral-200'}
        ${data.disabled ? 'opacity-50' : ''}
        ${getStatusColor()}
      `}
      onDoubleClick={handleDoubleClick}
    >
      {/* Input Handle - not shown for trigger nodes */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-neutral-300 !bg-white"
        />
      )}

      {/* Node Content */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className={`
            flex h-10 w-10 items-center justify-center rounded-lg
            ${isTrigger ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}
          `}
        >
          <IconComponent size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-neutral-800">
            {data.label}
          </span>
          {data.description && (
            <span className="text-xs text-neutral-500">{data.description}</span>
          )}
        </div>
      </div>

      {/* Execution status indicator */}
      {executionData?.status === 'running' && (
        <div className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-yellow-500" />
      )}
      {executionData?.status === 'success' && (
        <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-green-500" />
      )}
      {executionData?.status === 'error' && (
        <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500" />
      )}

      {/* Output Handle with + button */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-neutral-300 !bg-white"
      />

    </div>

      {/* Add Node Button - always rendered, visibility controlled by opacity */}
      <button
        onClick={handleAddNode}
        className={`
          nodrag absolute -right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center
          rounded-full bg-blue-500 text-white shadow-md transition-all
          hover:bg-blue-600 hover:scale-110
          ${showActions ? 'opacity-100' : 'opacity-0'}
        `}
        style={{ pointerEvents: 'all' }}
      >
        <Plus size={16} />
      </button>

      {/* Quick Actions - shows on hover or when selected */}
      {showActions && (
        <div className="nodrag absolute -top-10 left-1/2 flex -translate-x-1/2 gap-1 rounded-md bg-white p-1 shadow-md border border-neutral-200">
          <button
            className="rounded p-1.5 hover:bg-neutral-100"
            title="Run node"
          >
            <Play size={14} className="text-neutral-600" />
          </button>
          <button
            className="rounded p-1.5 hover:bg-neutral-100"
            title="More options"
            onClick={(e) => {
              e.stopPropagation();
              // Would open context menu
            }}
          >
            <MoreHorizontal size={14} className="text-neutral-600" />
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(WorkflowNode);
