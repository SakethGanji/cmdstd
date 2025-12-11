import { useMemo } from 'react';
import ReactFlow, { Background, type Node, type Edge } from 'reactflow';
import 'reactflow/dist/style.css';

import type { WorkflowDefinition } from '../hooks/useWorkflows';
import { getNodeGroupFromType, getNodeStyles } from '@/features/workflow-editor/lib/nodeStyles';

interface WorkflowThumbnailProps {
  definition: WorkflowDefinition;
  className?: string;
}

// Simplified node component for thumbnails
function ThumbnailNode({ data }: { data: { type: string; label: string } }) {
  const nodeGroup = getNodeGroupFromType(data.type);
  const styles = getNodeStyles(nodeGroup);

  return (
    <div
      className="rounded-md border px-2 py-1 text-[8px] font-medium shadow-sm"
      style={{
        backgroundColor: styles.bgColor,
        borderColor: styles.borderColor,
        color: styles.accentColor,
        maxWidth: '60px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {data.label}
    </div>
  );
}

const nodeTypes = {
  thumbnail: ThumbnailNode,
};

export function WorkflowThumbnail({ definition, className }: WorkflowThumbnailProps) {
  const { nodes, edges } = useMemo(() => {
    // Convert backend nodes to ReactFlow format
    const rfNodes: Node[] = definition.nodes.map((node) => ({
      id: node.name,
      type: 'thumbnail',
      position: node.position || { x: 0, y: 0 },
      data: {
        type: node.type,
        label: node.name,
      },
      draggable: false,
      selectable: false,
      connectable: false,
    }));

    // Convert backend connections to ReactFlow edges
    const rfEdges: Edge[] = definition.connections.map((conn, index) => ({
      id: `edge-${index}`,
      source: conn.sourceNode,
      target: conn.targetNode,
      sourceHandle: conn.sourceOutput,
      targetHandle: conn.targetInput,
      type: 'smoothstep',
      style: {
        stroke: 'var(--muted-foreground)',
        strokeWidth: 1,
        opacity: 0.5,
      },
    }));

    return { nodes: rfNodes, edges: rfEdges };
  }, [definition]);

  return (
    <div className={className}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.1,
          maxZoom: 1,
        }}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        className="bg-muted/30"
      >
        <Background gap={12} size={1} color="var(--border)" />
      </ReactFlow>
    </div>
  );
}
