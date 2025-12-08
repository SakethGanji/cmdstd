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

  // Execution status - only affects border, not background
  const getExecutionBorderColor = () => {
    if (!executionData) return null;
    switch (executionData.status) {
      case 'running':
        return '#f59e0b'; // amber-500
      case 'success':
        return '#10b981'; // emerald-500
      case 'error':
        return '#ef4444'; // red-500
      default:
        return null;
    }
  };

  // Execution status - icon background color
  const getExecutionIconBgColor = () => {
    if (!executionData) return null;
    switch (executionData.status) {
      case 'running':
        return '#fef3c7'; // amber-100
      case 'success':
        return '#d1fae5'; // emerald-100
      case 'error':
        return '#fee2e2'; // red-100
      default:
        return null;
    }
  };

  // Execution status - icon color
  const getExecutionIconColor = () => {
    if (!executionData) return null;
    switch (executionData.status) {
      case 'running':
        return '#f59e0b'; // amber-500
      case 'success':
        return '#10b981'; // emerald-500
      case 'error':
        return '#ef4444'; // red-500
      default:
        return null;
    }
  };

  const executionBorderColor = getExecutionBorderColor();
  const executionIconBgColor = getExecutionIconBgColor();
  const executionIconColor = getExecutionIconColor();
  const hasExecutionStatus = executionData?.status && executionData.status !== 'idle';

  // Get box shadow for glow effect based on execution status
  const getExecutionGlow = () => {
    if (!executionData) return undefined;
    switch (executionData.status) {
      case 'running':
        return '0 0 20px rgba(245, 158, 11, 0.4), 0 0 40px rgba(245, 158, 11, 0.2)';
      case 'success':
        return '0 0 20px rgba(16, 185, 129, 0.4), 0 0 40px rgba(16, 185, 129, 0.2)';
      case 'error':
        return '0 0 20px rgba(239, 68, 68, 0.4), 0 0 40px rgba(239, 68, 68, 0.2)';
      default:
        return undefined;
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
          relative cursor-grab rounded-xl border-2 transition-all duration-300
          ${selected ? 'ring-2 ring-offset-1' : ''}
          ${data.disabled ? 'opacity-50' : ''}
        `}
        style={{
          minHeight,
          backgroundColor: styles.bgColor,
          borderColor: executionBorderColor || (selected ? styles.accentColor : styles.borderColor),
          borderWidth: hasExecutionStatus ? 2 : 1,
          boxShadow: getExecutionGlow() || (selected ? `0 4px 12px ${styles.accentColor}40` : '0 1px 3px rgba(0,0,0,0.1)'),
          // @ts-expect-error CSS custom property
          '--tw-ring-color': executionBorderColor || styles.accentColor,
        }}
        onDoubleClick={handleDoubleClick}
      >
        {/* Input Handles */}
        {renderInputHandles()}

        {/* Node Content - Icon only */}
        <div className="flex items-center justify-center p-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-300"
            style={{
              backgroundColor: executionIconBgColor || styles.iconBgColor,
              color: executionIconColor || styles.accentColor,
            }}
          >
            <IconComponent size={20} />
          </div>
        </div>

        {/* Execution status indicator dot */}
        {executionData?.status === 'running' && (
          <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
        )}
        {executionData?.status === 'success' && (
          <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
        )}
        {executionData?.status === 'error' && (
          <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
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
