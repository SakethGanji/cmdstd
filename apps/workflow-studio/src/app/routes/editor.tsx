import { lazy, Suspense } from 'react'
import { createRoute } from '@tanstack/react-router'
import { ReactFlowProvider } from 'reactflow'
import { Loader2 } from 'lucide-react'
import { rootRoute } from './__root'

// Lazy load heavy components
const WorkflowCanvas = lazy(() => import('@/features/workflow-editor/components/canvas/WorkflowCanvas'))
const NodeCreatorPanel = lazy(() => import('@/features/workflow-editor/components/node-creator/NodeCreatorPanel'))
const NodeDetailsModal = lazy(() => import('@/features/workflow-editor/components/ndv/NodeDetailsModal'))
const WorkflowNavbar = lazy(() => import('@/features/workflow-editor/components/workflow-navbar/WorkflowNavbar'))
const ExecutionLogsPanel = lazy(() => import('@/features/workflow-editor/components/execution-logs/ExecutionLogsPanel'))

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
  component: EditorPage,
})

function EditorPage() {
  return (
    <ReactFlowProvider>
      <Suspense fallback={<EditorLoadingFallback />}>
        <div className="h-full w-full absolute inset-0">
          <WorkflowNavbar />
          <WorkflowCanvas />
          <NodeCreatorPanel />
          <NodeDetailsModal />
          <ExecutionLogsPanel />
        </div>
      </Suspense>
    </ReactFlowProvider>
  )
}
