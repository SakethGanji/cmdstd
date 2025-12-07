import { createRoute } from '@tanstack/react-router'
import { ReactFlowProvider } from 'reactflow'

import WorkflowCanvas from '@/components/canvas/WorkflowCanvas'
import NodeCreatorPanel from '@/components/node-creator/NodeCreatorPanel'
import NodeDetailsModal from '@/components/ndv/NodeDetailsModal'
import { rootRoute } from './__root'

export const editorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'editor',
  component: EditorPage,
})

function EditorPage() {
  return (
    <ReactFlowProvider>
      <div className="h-full w-full absolute inset-0">
        <WorkflowCanvas />
        <NodeCreatorPanel />
        <NodeDetailsModal />
      </div>
    </ReactFlowProvider>
  )
}
