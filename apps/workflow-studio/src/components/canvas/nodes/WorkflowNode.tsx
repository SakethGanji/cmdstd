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
  AlertTriangle,
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
  'alert-triangle': AlertTriangle,
};

function WorkflowNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const [isHovered, setIsHovered] = useState(false);
  const openForConnection = useNodeCreatorStore((s) => s.openForConnection);
  const openNDV = useNDVStore((s) => s.openNDV);
  const executionData = useWorkflowStore((s) => s.executionData[id]);

  const IconComponent = iconMap[data.icon || 'code'] || Code;
  const isTrigger = data.type?.includes('Trigger') || data.type?.includes('trigger');
  // Note: isTrigger is used below for handle visibility

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
    if (!executionData) return 'bg-muted';
    switch (executionData.status) {
      case 'running':
        return 'bg-amber-100 border-amber-400 dark:bg-amber-950 dark:border-amber-600';
      case 'success':
        return 'bg-emerald-100 border-emerald-400 dark:bg-emerald-950 dark:border-emerald-600';
      case 'error':
        return 'bg-destructive/10 border-destructive';
      default:
        return 'bg-muted';
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
        relative flex min-w-[150px] cursor-grab flex-col rounded-lg border-2 bg-card shadow-md transition-all
        ${selected ? 'border-primary shadow-lg' : 'border-border'}
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
          className="!h-3 !w-3 !border-2 !border-border !bg-card"
        />
      )}

      {/* Node Content */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <IconComponent size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            {data.label}
          </span>
          {data.description && (
            <span className="text-xs text-muted-foreground">{data.description}</span>
          )}
        </div>
      </div>

      {/* Execution status indicator */}
      {executionData?.status === 'running' && (
        <div className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-amber-500" />
      )}
      {executionData?.status === 'success' && (
        <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-500" />
      )}
      {executionData?.status === 'error' && (
        <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-destructive" />
      )}

      {/* Output Handle with + button */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-border !bg-card"
      />

    </div>

      {/* Add Node Button - always rendered, visibility controlled by opacity */}
      <button
        onClick={handleAddNode}
        className={`
          nodrag absolute -right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center
          rounded-full bg-primary text-primary-foreground shadow-md transition-all
          hover:bg-primary/90 hover:scale-110
          ${showActions ? 'opacity-100' : 'opacity-0'}
        `}
        style={{ pointerEvents: 'all' }}
      >
        <Plus size={16} />
      </button>

      {/* Quick Actions - shows on hover or when selected */}
      {showActions && (
        <div className="nodrag absolute -top-10 left-1/2 flex -translate-x-1/2 gap-1 rounded-lg bg-popover p-1 shadow-md border border-border">
          <button
            className="rounded-md p-1.5 hover:bg-accent"
            title="Run node"
          >
            <Play size={14} className="text-muted-foreground" />
          </button>
          <button
            className="rounded-md p-1.5 hover:bg-accent"
            title="More options"
            onClick={(e) => {
              e.stopPropagation();
              // Would open context menu
            }}
          >
            <MoreHorizontal size={14} className="text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(WorkflowNode);
