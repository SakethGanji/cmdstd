import { memo, useMemo } from 'react';
import ReactFlow, { Handle, Position, type NodeProps, ReactFlowProvider } from 'reactflow';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, AlertCircle, Loader2, Check, X } from 'lucide-react';
import { useWorkflowStore } from '../../../stores/workflowStore';
import { useNDVStore } from '../../../stores/ndvStore';
import type { WorkflowNodeData } from '../../../types/workflow';
import { backends } from '@/shared/lib/config';
import { fromBackendWorkflow } from '../../../lib/workflowTransform';
import WorkflowNode from './WorkflowNode';
import WorkflowEdge from '../edges/WorkflowEdge';

// Inner ReactFlow uses the same node/edge types (minus subworkflow to avoid recursion)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const innerNodeTypes: any = {
  workflowNode: WorkflowNode,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const innerEdgeTypes: any = {
  workflowEdge: WorkflowEdge,
};

const TITLE_BAR_HEIGHT = 36;
const CONTAINER_WIDTH = 500;
const CONTAINER_HEIGHT = 300;

function SubworkflowNodeInner({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const executionData = useWorkflowStore((s) => s.executionData[id]);
  const openNDV = useNDVStore((s) => s.openNDV);
  const subworkflowId = data.subworkflowId;

  // Fetch the referenced workflow as a full API response, then transform it
  const { data: innerFlow, isLoading, isError } = useQuery({
    queryKey: ['workflow-preview', subworkflowId],
    queryFn: async () => {
      const res = await fetch(`${backends.workflow}/api/workflows/${subworkflowId}`);
      if (!res.ok) throw new Error('Workflow not found');
      const apiData = await res.json();
      // Use the same transform the editor uses — produces identical ReactFlow nodes/edges
      const { nodes, edges } = fromBackendWorkflow(apiData);
      return { nodes, edges };
    },
    enabled: !!subworkflowId,
    staleTime: 60_000,
    retry: 1,
  });

  const handleOpenSubworkflow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (subworkflowId) {
      window.open(`/editor?workflowId=${subworkflowId}`, '_blank');
    }
  };

  const isRunning = executionData?.status === 'running';
  const isSuccess = executionData?.status === 'success';
  const isError_ = executionData?.status === 'error';

  // Convert any subworkflowNode types to workflowNode for inner rendering (avoid recursion)
  const safeNodes = useMemo(() => {
    if (!innerFlow?.nodes) return [];
    return innerFlow.nodes.map((n) =>
      n.type === 'subworkflowNode' ? { ...n, type: 'workflowNode' } : n
    );
  }, [innerFlow?.nodes]);

  const safeEdges = innerFlow?.edges ?? [];

  return (
    <div className="relative flex flex-col items-center">
      <div
        className={`
          relative cursor-grab border-2 border-dashed rounded-xl transition-all duration-300 overflow-hidden
          ${selected ? 'ring-2 ring-offset-1 ring-[var(--node-flow)]' : ''}
          ${isRunning ? 'animate-pulse-border' : ''}
        `}
        style={{
          width: CONTAINER_WIDTH,
          height: CONTAINER_HEIGHT,
          backgroundColor: 'var(--node-flow-light)',
          borderColor: isRunning ? 'var(--node-flow)' : (selected ? 'var(--node-flow)' : 'var(--node-flow-border)'),
          boxShadow: selected ? '0 4px 12px var(--node-flow)40' : '0 1px 3px rgba(0,0,0,0.1)',
        }}
        onDoubleClick={(e) => { e.stopPropagation(); openNDV(id); }}
      >
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="main"
          style={{ top: '50%', backgroundColor: 'var(--node-handle)', borderColor: 'var(--node-handle)' }}
          className="!h-1.5 !w-1.5 !border-2"
        />

        {/* Title bar */}
        <div
          className="flex items-center gap-2 px-3 border-b"
          style={{
            height: TITLE_BAR_HEIGHT,
            backgroundColor: 'var(--node-flow-icon-bg)',
            borderColor: 'var(--node-flow-border)',
          }}
        >
          <span className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--node-flow)' }}>
            {data.label || 'Subworkflow'}
          </span>
          <button
            className="nodrag shrink-0 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
            style={{ color: 'var(--node-flow)', pointerEvents: 'all' }}
            onClick={handleOpenSubworkflow}
            title="Open in editor"
          >
            <ExternalLink size={12} />
          </button>
        </div>

        {/* Inner workflow — rendered by a real ReactFlow instance */}
        <div
          className="relative"
          style={{ height: CONTAINER_HEIGHT - TITLE_BAR_HEIGHT, pointerEvents: 'none' }}
        >
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {isError && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-1.5">
              <AlertCircle size={18} className="text-red-400" />
              <span className="text-xs text-red-400">Workflow not found</span>
            </div>
          )}

          {!isLoading && !isError && safeNodes.length > 0 && (
            <ReactFlowProvider>
              <ReactFlow
                nodes={safeNodes}
                edges={safeEdges}
                nodeTypes={innerNodeTypes}
                edgeTypes={innerEdgeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag={false}
                zoomOnScroll={false}
                zoomOnPinch={false}
                zoomOnDoubleClick={false}
                preventScrolling={false}
                proOptions={{ hideAttribution: true }}
                minZoom={0.1}
                maxZoom={1}
              />
            </ReactFlowProvider>
          )}
        </div>

        {/* Outer status badges */}
        {isSuccess && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-sm animate-badge-pop z-10">
            <Check size={12} strokeWidth={3} />
          </div>
        )}
        {isError_ && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white shadow-sm animate-badge-pop z-10">
            <X size={12} strokeWidth={3} />
          </div>
        )}

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="main"
          style={{ top: '50%', backgroundColor: 'var(--node-handle)', borderColor: 'var(--node-handle)' }}
          className="!h-1.5 !w-1.5 !border-2"
        />
      </div>

      {/* Container Label */}
      <span
        className="text-center text-xs font-medium text-muted-foreground leading-tight truncate mt-2"
        style={{ maxWidth: CONTAINER_WIDTH + 40 }}
        title={data.label}
      >
        {data.label}
      </span>
    </div>
  );
}

// Wrap in memo — the ReactFlowProvider must be inside the component, not wrapping memo
export default memo(SubworkflowNodeInner);
