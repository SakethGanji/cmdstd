import { memo, useState, useMemo } from 'react';
import {
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from 'reactflow';
import { Plus } from 'lucide-react';
import { useNodeCreatorStore } from '../../../stores/nodeCreatorStore';
import { useWorkflowStore } from '../../../stores/workflowStore';
import type { WorkflowNodeData } from '../../../types/workflow';

// Edge colors for different states
const EDGE_COLORS = {
  default: { start: '#9ca3af', end: '#6b7280' },
  hover: { start: '#6b7280', end: '#4b5563' },
  running: { start: '#fbbf24', end: '#f59e0b' },  // amber gradient
  success: { start: '#34d399', end: '#10b981' },  // emerald gradient
  error: { start: '#f87171', end: '#ef4444' },    // red gradient
};

function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  source,
  target,
  sourceHandleId,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const openForConnection = useNodeCreatorStore((s) => s.openForConnection);
  const { getNode } = useReactFlow();
  const executionData = useWorkflowStore((s) => s.executionData);

  // Determine edge status based on source and target node execution states
  const edgeStatus = useMemo(() => {
    const sourceExec = executionData[source];
    const targetExec = executionData[target];

    // If target is running, the edge is "active" (data flowing through)
    if (targetExec?.status === 'running') return 'running';
    // If target completed successfully, edge is done
    if (targetExec?.status === 'success') return 'success';
    // If target errored, edge shows error
    if (targetExec?.status === 'error') return 'error';
    // If source completed but target hasn't started, edge is "pending flow"
    if (sourceExec?.status === 'success' && !targetExec) return 'running';

    return 'default';
  }, [source, target, executionData]);

  // Get the output label from the source node's outputs array
  const outputLabel = useMemo(() => {
    const sourceNode = getNode(source);
    if (!sourceNode) return null;

    const nodeData = sourceNode.data as WorkflowNodeData;
    const outputs = nodeData.outputs || [];
    const outputCount = nodeData.outputCount ?? outputs.length;

    // Only show labels if node has multiple outputs
    if (outputCount <= 1) return null;

    // Find the output that matches the sourceHandleId
    let output;
    if (sourceHandleId) {
      // Try to find by exact name match
      output = outputs.find((o) => o.name === sourceHandleId);
    }

    // If no sourceHandleId or no match found, try to find by index pattern (output-0, output-1)
    if (!output && sourceHandleId?.startsWith('output-')) {
      const index = parseInt(sourceHandleId.replace('output-', ''), 10);
      if (!isNaN(index) && outputs[index]) {
        output = outputs[index];
      }
    }

    // If still no match and no sourceHandleId, use first output (default connection)
    if (!output && !sourceHandleId && outputs.length > 0) {
      output = outputs[0];
    }

    if (!output) return null;

    // Get the label (prefer displayName over name)
    const label = output.displayName || output.name;

    // Don't show label for generic names
    const genericNames = ['main', 'output', 'Output'];
    if (genericNames.includes(label)) return null;

    return label;
  }, [source, sourceHandleId, getNode]);

  // Use smooth step path - right-angle turns with rounded corners
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  // Use userSpaceOnUse with actual coordinates to ensure gradient works on straight lines
  // objectBoundingBox (default) fails when the bounding box has zero width or height
  const gradientCoords = {
    x1: sourceX,
    y1: sourceY,
    x2: targetX,
    y2: targetY,
  };

  const handleAddNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    openForConnection(source, `edge-${id}`);
  };

  // Get edge colors based on status and hover state
  const edgeColors = useMemo(() => {
    if (edgeStatus !== 'default') {
      return EDGE_COLORS[edgeStatus];
    }
    return isHovered ? EDGE_COLORS.hover : EDGE_COLORS.default;
  }, [edgeStatus, isHovered]);

  // Animation for running/active edges
  const isAnimated = edgeStatus === 'running';

  // Unique gradient ID for this edge
  const gradientId = `edge-gradient-${id}`;

  return (
    <>
      {/* Gradient and marker definitions */}
      <defs>
        {/* Gradient for the edge - use userSpaceOnUse to work with straight lines */}
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" {...gradientCoords}>
          <stop offset="0%" stopColor={edgeColors.start} />
          <stop offset="100%" stopColor={edgeColors.end} />
        </linearGradient>

        {/* Arrow marker with gradient color */}
        <marker
          id={`arrow-${id}`}
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M2,2 L10,6 L2,10 L4,6 Z"
            fill={edgeColors.end}
          />
        </marker>
      </defs>

      {/* Subtle highlight layer for active edges (no blur, just thicker stroke) */}
      {edgeStatus !== 'default' && (
        <path
          d={edgePath}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={4}
          strokeOpacity={0.2}
          strokeLinecap="round"
        />
      )}

      {/* Main edge path with gradient */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={edgeStatus !== 'default' ? 2.5 : (isHovered ? 2 : 1.5)}
        markerEnd={`url(#arrow-${id})`}
        style={{
          ...style,
          strokeDasharray: isAnimated ? '8 4' : 'none',
          animation: isAnimated ? 'flowAnimation 0.5s linear infinite' : 'none',
        }}
      />

      {/* Invisible interaction path */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="react-flow__edge-interaction"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* CSS for flow animation */}
      <style>
        {`
          @keyframes flowAnimation {
            from {
              stroke-dashoffset: 24;
            }
            to {
              stroke-dashoffset: 0;
            }
          }
        `}
      </style>

      {/* Output label near the source node */}
      {outputLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(0, -50%) translate(${sourceX + 14}px, ${sourceY}px)`,
              pointerEvents: 'none',
              color: edgeColors.end,
            }}
            className="text-[10px] font-medium bg-background/90 px-1.5 py-0.5 rounded"
          >
            {outputLabel}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Add node button on hover */}
      {isHovered && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              onClick={handleAddNode}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-all hover:bg-accent hover:scale-110"
            >
              <Plus size={14} className="text-muted-foreground" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(WorkflowEdge);
