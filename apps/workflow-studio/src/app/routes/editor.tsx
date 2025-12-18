import { lazy, Suspense, useEffect } from 'react'
import { createRoute } from '@tanstack/react-router'
import { ReactFlowProvider } from 'reactflow'
import { Loader2 } from 'lucide-react'
import { rootRoute } from './__root'
import { useWorkflowStore } from '@/features/workflow-editor/stores/workflowStore'
import { useUIModeStore } from '@/features/workflow-editor/stores/uiModeStore'
import { fromBackendWorkflow } from '@/features/workflow-editor/lib/workflowTransform'
import { backends } from '@/shared/lib/config'

// Lazy load heavy components
const WorkflowCanvas = lazy(() => import('@/features/workflow-editor/components/canvas/WorkflowCanvas'))
const NodeCreatorPanel = lazy(() => import('@/features/workflow-editor/components/node-creator/NodeCreatorPanel'))
const NodeDetailsModal = lazy(() => import('@/features/workflow-editor/components/ndv/NodeDetailsModal'))
const WorkflowNavbar = lazy(() => import('@/features/workflow-editor/components/workflow-navbar/WorkflowNavbar'))
const ExecutionLogsPanel = lazy(() => import('@/features/workflow-editor/components/execution-logs/ExecutionLogsPanel'))
const UIPreviewPanel = lazy(() => import('@/features/workflow-editor/components/ui-preview/UIPreviewPanel'))

function EditorLoadingFallback() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading editor...</p>
      </div>
    </div>
  )
}

export const editorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'editor',
  validateSearch: (search: Record<string, unknown>): { workflowId?: string } => ({
    workflowId: search.workflowId as string | undefined,
  }),
  component: EditorPage,
})

function EditorPage() {
  const { workflowId } = editorRoute.useSearch()
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow)
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow)
  const currentWorkflowId = useWorkflowStore((s) => s.workflowId)

  useEffect(() => {
    if (!workflowId) {
      // No workflow ID - reset to empty state if we had one loaded
      if (currentWorkflowId) {
        resetWorkflow()
      }
      return
    }

    // Don't reload if same workflow
    if (workflowId === currentWorkflowId) {
      return
    }

    // Fetch and load workflow
    async function fetchWorkflow() {
      try {
        const res = await fetch(`${backends.workflow}/api/workflows/${workflowId}`)
        if (!res.ok) throw new Error('Failed to fetch workflow')
        const data = await res.json()
        const transformed = fromBackendWorkflow(data)
        loadWorkflow(transformed)
      } catch (error) {
        console.error('Failed to load workflow:', error)
      }
    }

    fetchWorkflow()
  }, [workflowId, currentWorkflowId, loadWorkflow, resetWorkflow])

  const mode = useUIModeStore((s) => s.mode)

  return (
    <ReactFlowProvider>
      <Suspense fallback={<EditorLoadingFallback />}>
        <div className="h-full w-full absolute inset-0">
          <WorkflowNavbar />
          {mode === 'builder' ? (
            <>
              <WorkflowCanvas />
              <NodeCreatorPanel />
              <NodeDetailsModal />
              <ExecutionLogsPanel />
            </>
          ) : (
            <UIPreviewPanel />
          )}
        </div>
      </Suspense>
    </ReactFlowProvider>
  )
}
