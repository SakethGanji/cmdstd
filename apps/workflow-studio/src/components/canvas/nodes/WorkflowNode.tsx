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

  // Calculate input/output counts
  const inputCount = isTrigger ? 0 : (data.inputCount ?? data.inputs?.length ?? 1);
  const outputCount = data.outputCount ?? data.outputs?.length ?? 1;

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

  const handleAddNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    openForConnection(id, 'source');
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

  // Determine if we should show input labels
  const shouldShowInputLabels = useMemo(() => {
    if (!data.inputs || data.inputs.length === 0) return false;
    if (inputCount > 1) return true;
    // For single input, show label if it has a specific name
    const firstInput = data.inputs[0];
    const genericNames = ['main', 'input', 'Input'];
    return firstInput?.displayName && !genericNames.includes(firstInput.displayName);
  }, [data.inputs, inputCount]);

  // Render input handles with labels
  const renderInputHandles = () => {
    if (isTrigger || inputCount === 0) return null;

    return inputPositions.map((position, index) => {
      const inputDef = data.inputs?.[index];
      const label = inputDef?.displayName || inputDef?.name;
      const showLabel = shouldShowInputLabels && label;

      return (
        <div key={`input-wrapper-${index}`}>
          <Handle
            type="target"
            position={Position.Left}
            id={inputDef?.name || `input-${index}`}
            style={{
              top: `${position}%`,
              backgroundColor: styles.handleColor,
              borderColor: styles.handleColor,
            }}
            className="!h-3 !w-3 !border-2"
          />
          {showLabel && (
            <span
              className="absolute text-[10px] text-muted-foreground whitespace-nowrap pointer-events-none"
              style={{
                left: '20px',
                top: `${position}%`,
                transform: 'translateY(-50%)',
              }}
            >
              {label}
            </span>
          )}
        </div>
      );
    });
  };

  // Determine if we should show output labels
  // Show labels when: multiple outputs OR single output with a meaningful name (not generic "Output" or "main")
  const shouldShowOutputLabels = useMemo(() => {
    if (!data.outputs || data.outputs.length === 0) return false;
    if (outputCount > 1) return true;
    // For single output, show label if it has a specific name
    const firstOutput = data.outputs[0];
    const genericNames = ['main', 'output', 'Output'];
    return firstOutput?.displayName && !genericNames.includes(firstOutput.displayName);
  }, [data.outputs, outputCount]);

  // Render output handles with labels
  const renderOutputHandles = () => {
    return outputPositions.map((position, index) => {
      const outputDef = data.outputs?.[index];
      const label = outputDef?.displayName || outputDef?.name;
      const showLabel = shouldShowOutputLabels && label;

      return (
        <div key={`output-wrapper-${index}`}>
          <Handle
            type="source"
            position={Position.Right}
            id={outputDef?.name || `output-${index}`}
            style={{
              top: `${position}%`,
              backgroundColor: styles.handleColor,
              borderColor: styles.handleColor,
            }}
            className="!h-3 !w-3 !border-2"
          />
          {showLabel && (
            <span
              className="absolute text-[10px] text-muted-foreground whitespace-nowrap pointer-events-none"
              style={{
                right: '20px',
                top: `${position}%`,
                transform: 'translateY(-50%)',
              }}
            >
              {label}
            </span>
          )}
        </div>
      );
    });
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`
          relative flex min-w-[150px] cursor-grab flex-col rounded-lg border-2 shadow-md transition-all
          ${selected ? 'shadow-lg ring-2 ring-offset-1' : ''}
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

        {/* Node Content */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: styles.iconBgColor,
              color: styles.accentColor,
            }}
          >
            <IconComponent size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              {data.label}
            </span>
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

      {/* Add Node Button - always rendered, visibility controlled by opacity */}
      <button
        onClick={handleAddNode}
        className={`
          nodrag absolute -right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center
          rounded-full shadow-md transition-all
          hover:scale-110
          ${showActions ? 'opacity-100' : 'opacity-0'}
        `}
        style={{
          backgroundColor: styles.accentColor,
          color: 'white',
          pointerEvents: 'all',
        }}
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
