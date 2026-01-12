import { memo, useState, useMemo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Plus, Play, MoreHorizontal, Check, X } from 'lucide-react';
import { useNodeCreatorStore } from '../../../stores/nodeCreatorStore';
import { useNDVStore } from '../../../stores/ndvStore';
import { useWorkflowStore } from '../../../stores/workflowStore';
import type { WorkflowNodeData } from '../../../types/workflow';
import {
  getNodeGroupFromType,
  getNodeStyles,
  getNodeShapeConfig,
  calculateHandlePositions,
  calculateNodeDimensions,
  type NodeGroup,
} from '../../../lib/nodeStyles';
import { getIconForNode } from '../../../lib/nodeIcons';
import { isTriggerType } from '../../../lib/nodeConfig';

// Status badge component for success/error states
const StatusBadge = ({ status }: { status: 'success' | 'error' }) => {
  const isSuccess = status === 'success';
  return (
    <div
      className={`
        absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full
        flex items-center justify-center text-white
        shadow-sm animate-badge-pop z-10
        ${isSuccess ? 'bg-emerald-500' : 'bg-red-500'}
      `}
    >
      {isSuccess ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
    </div>
  );
};

function WorkflowNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const [isHovered, setIsHovered] = useState(false);
  const openForConnection = useNodeCreatorStore((s) => s.openForConnection);
  const openForSubnode = useNodeCreatorStore((s) => s.openForSubnode);
  const openNDV = useNDVStore((s) => s.openNDV);
  const executionData = useWorkflowStore((s) => s.executionData[id]);

  const IconComponent = useMemo(
    () => getIconForNode(data.icon, data.type),
    [data.icon, data.type]
  );
  // Use centralized trigger detection (backend types only)
  const isTrigger = isTriggerType(data.type || '');

  // Get group-based styling and shape
  const nodeGroup = useMemo(
    () => getNodeGroupFromType(data.type, data.group ? [data.group] : undefined),
    [data.type, data.group]
  );
  const styles = useMemo(() => getNodeStyles(nodeGroup), [nodeGroup]);
  const shapeConfig = useMemo(() => getNodeShapeConfig(nodeGroup), [nodeGroup]);

  // Calculate input/output counts (ensure at least 1 input for non-triggers, at least 1 output)
  const inputCount = isTrigger ? 0 : Math.max(1, data.inputCount ?? data.inputs?.length ?? 1);
  const outputCount = Math.max(1, data.outputCount ?? data.outputs?.length ?? 1);

  // Calculate dimensions and handle positions (proportional sizing)
  const subnodeSlotCount = data.subnodeSlots?.length ?? 0;
  const dimensions = useMemo(
    () => calculateNodeDimensions(inputCount, outputCount, subnodeSlotCount),
    [inputCount, outputCount, subnodeSlotCount]
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

  // Execution status flags
  const isRunning = executionData?.status === 'running';
  const isSuccess = executionData?.status === 'success';
  const isError = executionData?.status === 'error';

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

  // Get edges to check which slots have connections
  const edges = useWorkflowStore((s) => s.edges);

  // Check if a slot can accept more subnodes
  const canSlotAcceptMore = (slotName: string, multiple: boolean) => {
    if (multiple) return true; // Multiple slots always show +
    // Check if there's already a connection to this slot
    const hasConnection = edges.some(
      (e) => e.target === id && e.targetHandle === slotName && e.data?.isSubnodeEdge
    );
    return !hasConnection;
  };

  // Render bottom section for subnode slots (n8n style - inside node)
  const renderSubnodeSlotSection = () => {
    const slots = data.subnodeSlots;
    if (!slots || slots.length === 0) return null;

    return (
      <>
        {/* Handles and + buttons at bottom - one per slot */}
        {slots.map((slot, index) => {
          // Position evenly across the node width
          const slotPercent = (index + 0.5) / slots.length * 100;
          const canAdd = canSlotAcceptMore(slot.name, slot.multiple);

          return (
            <div key={`slot-group-${slot.name}`}>
              {/* Handle */}
              <Handle
                type="target"
                position={Position.Bottom}
                id={slot.name}
                style={{
                  left: `${slotPercent}%`,
                  bottom: '-4px',
                }}
                className="!h-1.5 !w-1.5 !border !bg-muted-foreground/50 !border-muted-foreground/50"
              />

              {/* + button for this slot (only if can accept more) */}
              {canAdd && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openForSubnode(id, slot.name, slot.slotType as 'model' | 'memory' | 'tool');
                  }}
                  className={`
                    nodrag absolute flex h-4 w-4 items-center justify-center
                    rounded-full border border-border/50 bg-card/90 backdrop-blur-sm
                    transition-all hover:scale-110 hover:bg-accent hover:shadow-md
                    ${showActions ? 'opacity-100' : 'opacity-0'}
                  `}
                  style={{
                    bottom: '-20px',
                    left: `${slotPercent}%`,
                    transform: 'translateX(-50%)',
                    pointerEvents: 'all',
                  }}
                  title={`Add ${slot.displayName}`}
                >
                  <Plus size={10} className="text-muted-foreground" />
                </button>
              )}
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`
          relative cursor-grab border transition-all duration-300 flex items-center justify-center
          ${selected ? 'ring-2 ring-offset-1' : ''}
          ${data.disabled ? 'opacity-50' : ''}
          ${isRunning ? 'animate-pulse-border' : ''}
        `}
        style={{
          height: dimensions.height,
          width: dimensions.width,
          backgroundColor: styles.bgColor,
          borderColor: isRunning ? styles.accentColor : (selected ? styles.accentColor : styles.borderColor),
          borderWidth: 2,
          borderRadius: shapeConfig.borderRadius,
          boxShadow: selected ? `0 4px 12px ${styles.accentColor}40` : '0 1px 3px rgba(0,0,0,0.1)',
          // @ts-expect-error CSS custom property
          '--tw-ring-color': styles.accentColor,
        }}
        onDoubleClick={handleDoubleClick}
      >
        {/* Input Handles */}
        {renderInputHandles()}

        {/* Node Content - Icon only, centered */}
        <div
          className={`
            flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-300
            ${nodeGroup === 'ai' ? 'node-ai-shimmer' : ''}
          `}
          style={{
            backgroundColor: nodeGroup !== 'ai' ? styles.iconBgColor : undefined,
            color: styles.accentColor,
          }}
        >
          <IconComponent size={20} />
        </div>

        {/* Status badges for success/error */}
        {isSuccess && <StatusBadge status="success" />}
        {isError && <StatusBadge status="error" />}

        {/* Output Handles */}
        {renderOutputHandles()}

        {/* Subnode Slot Section (bottom - n8n style) */}
        {renderSubnodeSlotSection()}
      </div>

      {/* Node Label - Below the node */}
      <span
        className={`text-center text-xs font-medium text-muted-foreground leading-tight truncate ${subnodeSlotCount > 0 ? 'mt-6' : 'mt-2'}`}
        style={{ maxWidth: Math.max(120, dimensions.width + 40) }}
        title={data.label}
      >
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
