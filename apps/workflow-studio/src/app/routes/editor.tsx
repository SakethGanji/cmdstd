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
const UIPreviewSidePanel = lazy(() => import('@/features/workflow-editor/components/ui-preview/UIPreviewSidePanel'))

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
      if (currentWorkflowId) {
        resetWorkflow()
      }
      return
    }

    if (workflowId === currentWorkflowId) {
      return
    }

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

  const isPreviewOpen = useUIModeStore((s) => s.isPreviewOpen)

  return (
    <ReactFlowProvider>
      <Suspense fallback={<EditorLoadingFallback />}>
        <div className="h-full w-full relative">
          <WorkflowNavbar />

          {/* Canvas - always full size */}
          <div className="h-full relative">
            <WorkflowCanvas />
            <NodeCreatorPanel />
            <NodeDetailsModal />
            <ExecutionLogsPanel />
          </div>

          {/* Floating side panel */}
          {isPreviewOpen && (
            <div className="absolute top-3 right-3 bottom-3 w-[380px] z-20 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
              <UIPreviewSidePanel />
            </div>
          )}
        </div>
      </Suspense>
    </ReactFlowProvider>
  )
}
