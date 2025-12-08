import { memo, useState, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  MarkerType,
  type EdgeProps,
} from 'reactflow';
import { Plus } from 'lucide-react';
import { useNodeCreatorStore } from '../../../stores/nodeCreatorStore';
import type { WorkflowNodeData } from '../../../types/workflow';

// Gray color for edges
const EDGE_COLOR = '#9ca3af';
const EDGE_COLOR_HOVER = '#6b7280';

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
  sourceHandleId,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const openForConnection = useNodeCreatorStore((s) => s.openForConnection);
  const { getNode } = useReactFlow();

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

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const handleAddNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    openForConnection(source, `edge-${id}`);
  };

  const edgeColor = isHovered ? EDGE_COLOR_HOVER : EDGE_COLOR;

  return (
    <>
      {/* Custom arrow marker definition */}
      <defs>
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
            fill={edgeColor}
          />
        </marker>
        <marker
          id={`arrow-${id}-hover`}
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M2,2 L10,6 L2,10 L4,6 Z"
            fill={EDGE_COLOR_HOVER}
          />
        </marker>
      </defs>

      <BaseEdge
        path={edgePath}
        markerEnd={`url(#arrow-${id}${isHovered ? '-hover' : ''})`}
        style={{
          ...style,
          strokeWidth: isHovered ? 2.5 : 1.5,
          stroke: edgeColor,
        }}
        interactionWidth={20}
      />
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="react-flow__edge-interaction"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Output label near the source node */}
      {outputLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(0, -50%) translate(${sourceX + 14}px, ${sourceY}px)`,
              pointerEvents: 'none',
              color: EDGE_COLOR,
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
