import { memo, useState, useMemo } from 'react';
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
  MessageSquare,
  Bot,
} from 'lucide-react';
import { useNodeCreatorStore } from '../../../stores/nodeCreatorStore';
import { useNDVStore } from '../../../stores/ndvStore';
import { useWorkflowStore } from '../../../stores/workflowStore';
import type { WorkflowNodeData } from '../../../types/workflow';
import {
  getNodeGroupFromType,
  getNodeStyles,
  calculateHandlePositions,
  calculateNodeMinHeight,
} from '../../../lib/nodeStyles';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'mouse-pointer': MousePointer,
  play: MousePointer,
  clock: Clock,
  webhook: Webhook,
  bolt: Webhook,
  code: Code,
  filter: Filter,
  'git-branch': GitBranch,
  'code-branch': GitBranch,
  route: Route,
  random: Route,
  'git-merge': GitMerge,
  'compress-arrows-alt': GitMerge,
  layers: Layers,
  'th-large': Layers,
  globe: Globe,
  pen: Pen,
  edit: Pen,
  calendar: Calendar,
  'calendar-alt': Calendar,
  'alert-triangle': AlertTriangle,
  'exclamation-triangle': AlertTriangle,
  'message-square': MessageSquare,
  'comment-dots': MessageSquare,
  bot: Bot,
  robot: Bot,
};

function WorkflowNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const [isHovered, setIsHovered] = useState(false);
  const openForConnection = useNodeCreatorStore((s) => s.openForConnection);
  const openNDV = useNDVStore((s) => s.openNDV);
  const executionData = useWorkflowStore((s) => s.executionData[id]);

  const IconComponent = iconMap[data.icon || 'code'] || Code;
  const isTrigger = data.type?.includes('Trigger') || data.type?.includes('trigger') ||
    data.type === 'Start' || data.type === 'manualTrigger' ||
    data.type === 'Webhook' || data.type === 'webhook' ||
    data.type === 'Cron' || data.type === 'scheduleTrigger';

  // Get group-based styling
  const nodeGroup = useMemo(
    () => getNodeGroupFromType(data.type, data.group ? [data.group] : undefined),
    [data.type, data.group]
  );
  const styles = useMemo(() => getNodeStyles(nodeGroup), [nodeGroup]);

  // Calculate input/output counts (ensure at least 1 input for non-triggers, at least 1 output)
  const inputCount = isTrigger ? 0 : Math.max(1, data.inputCount ?? data.inputs?.length ?? 1);
  const outputCount = Math.max(1, data.outputCount ?? data.outputs?.length ?? 1);

  // Calculate dimensions and handle positions
  const minHeight = useMemo(
    () => calculateNodeMinHeight(inputCount, outputCount),
    [inputCount, outputCount]
  );
  const inputPositions = useMemo(
    () => calculateHandlePositions(inputCount),
    [inputCount]
  );
  const outputPositions = useMemo(
    () => calculateHandlePositions(outputCount),
    [outputCount]
  );

  // Show actions when hovered OR selected
  const showActions = isHovered || selected;

  const handleAddNode = (e: React.MouseEvent, handleId: string) => {
    e.stopPropagation();
    openForConnection(id, handleId);
  };

  const handleDoubleClick = () => {
    openNDV(id);
  };

  // Execution status styles override group colors temporarily
  const getExecutionStyles = () => {
    if (!executionData) return {};
    switch (executionData.status) {
      case 'running':
        return {
          backgroundColor: 'var(--color-amber-100)',
          borderColor: 'var(--color-amber-400)',
        };
      case 'success':
        return {
          backgroundColor: 'var(--color-emerald-100)',
          borderColor: 'var(--color-emerald-400)',
        };
      case 'error':
        return {
          backgroundColor: 'hsl(var(--destructive) / 0.1)',
          borderColor: 'var(--destructive)',
        };
      default:
        return {};
    }
  };

  // Render input handles (labels shown on edges if needed)
  const renderInputHandles = () => {
    if (isTrigger || inputCount === 0) return null;

    return inputPositions.map((position, index) => {
      const inputDef = data.inputs?.[index];

      return (
        <Handle
          key={`input-${index}`}
          type="target"
          position={Position.Left}
          id={inputDef?.name || `input-${index}`}
          style={{
            top: `${position}%`,
            backgroundColor: styles.handleColor,
            borderColor: styles.handleColor,
          }}
          className="!h-1.5 !w-1.5 !border-2"
        />
      );
    });
  };

  // Render output handles with add buttons (labels are shown on edges)
  const renderOutputHandles = () => {
    return outputPositions.map((position, index) => {
      const outputDef = data.outputs?.[index];
      const handleId = outputDef?.name || `output-${index}`;

      return (
        <div key={`output-wrapper-${index}`}>
          <Handle
            type="source"
            position={Position.Right}
            id={handleId}
            style={{
              top: `${position}%`,
              backgroundColor: styles.handleColor,
              borderColor: styles.handleColor,
            }}
            className="!h-1.5 !w-1.5 !border-2"
          />
          {/* Add button for this output */}
          <button
            onClick={(e) => handleAddNode(e, handleId)}
            className={`
              nodrag absolute -right-7 flex h-5 w-5 items-center justify-center
              rounded-full border border-border bg-card shadow-sm transition-all
              hover:scale-110 hover:bg-accent hover:shadow-md
              ${showActions ? 'opacity-100' : 'opacity-0'}
            `}
            style={{
              top: `${position}%`,
              transform: 'translateY(-50%)',
              pointerEvents: 'all',
            }}
          >
            <Plus size={12} className="text-muted-foreground" />
          </button>
        </div>
      );
    });
  };

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`
          relative cursor-grab rounded-xl border shadow-sm transition-all
          ${selected ? 'shadow-md ring-2 ring-offset-1' : ''}
          ${data.disabled ? 'opacity-50' : ''}
        `}
        style={{
          minHeight,
          backgroundColor: styles.bgColor,
          borderColor: selected ? styles.accentColor : styles.borderColor,
          // @ts-expect-error CSS custom property
          '--tw-ring-color': styles.accentColor,
          ...getExecutionStyles(),
        }}
        onDoubleClick={handleDoubleClick}
      >
        {/* Input Handles */}
        {renderInputHandles()}

        {/* Node Content - Icon only */}
        <div className="flex items-center justify-center p-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: styles.iconBgColor,
              color: styles.accentColor,
            }}
          >
            <IconComponent size={20} />
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

        {/* Output Handles */}
        {renderOutputHandles()}
      </div>

      {/* Node Label - Below the node */}
      <span className="mt-2 max-w-[120px] text-center text-xs font-medium text-muted-foreground leading-tight">
        {data.label}
      </span>

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
