import { useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';

import { AppSidebar } from './components/app-sidebar';
import WorkflowCanvas from './components/canvas/WorkflowCanvas';
import NodeCreatorPanel from './components/node-creator/NodeCreatorPanel';
import NodeDetailsModal from './components/ndv/NodeDetailsModal';
import { SidebarInset, SidebarProvider } from './components/ui/sidebar';
import { useNodeCreatorStore } from './stores/nodeCreatorStore';

function App() {
  const closePanel = useNodeCreatorStore((s) => s.closePanel);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close node creator on Escape
      if (e.key === 'Escape') {
        closePanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closePanel]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="h-full w-full relative">
          <ReactFlowProvider>
            <div className="h-full w-full absolute inset-0">
              {/* Main Canvas */}
              <WorkflowCanvas />

              {/* Node Creator Side Panel */}
              <NodeCreatorPanel />

              {/* Node Details Modal (NDV) */}
              <NodeDetailsModal />
            </div>
          </ReactFlowProvider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
