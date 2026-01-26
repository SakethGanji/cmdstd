import { lazy, Suspense, useEffect, useCallback } from 'react'
import { createRoute } from '@tanstack/react-router'
import { ReactFlowProvider } from 'reactflow'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
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

  const isPreviewOpen = useUIModeStore((s) => s.isPreviewOpen)
  const previewPanelSize = useUIModeStore((s) => s.previewPanelSize)
  const setPreviewPanelSize = useUIModeStore((s) => s.setPreviewPanelSize)

  const handlePanelResize = useCallback((sizes: number[]) => {
    // sizes[1] is the preview panel size when it exists
    if (sizes.length > 1 && sizes[1] !== undefined) {
      setPreviewPanelSize(sizes[1])
    }
  }, [setPreviewPanelSize])

  return (
    <ReactFlowProvider>
      <Suspense fallback={<EditorLoadingFallback />}>
        <div className="h-full w-full fixed inset-0">
          <WorkflowNavbar />
          <div className="pt-14 h-full">
            <PanelGroup
              direction="horizontal"
              onLayout={handlePanelResize}
            >
              {/* Canvas panel - always visible */}
              <Panel defaultSize={isPreviewOpen ? 100 - previewPanelSize : 100} minSize={40}>
                <div className="h-full relative">
                  <WorkflowCanvas />
                  <NodeCreatorPanel />
                  <NodeDetailsModal />
                  <ExecutionLogsPanel />
                </div>
              </Panel>

              {/* UI Preview panel - conditional */}
              {isPreviewOpen && (
                <>
                  <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />
                  <Panel defaultSize={previewPanelSize} minSize={20} maxSize={60}>
                    <UIPreviewSidePanel />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </div>
        </div>
      </Suspense>
    </ReactFlowProvider>
  )
}
