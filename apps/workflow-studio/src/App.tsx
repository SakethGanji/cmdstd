import { useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';

import WorkflowCanvas from './components/canvas/WorkflowCanvas';
import NodeCreatorPanel from './components/node-creator/NodeCreatorPanel';
import NodeDetailsModal from './components/ndv/NodeDetailsModal';
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
    <ReactFlowProvider>
      <div className="h-full w-full">
        {/* Main Canvas */}
        <WorkflowCanvas />

        {/* Node Creator Side Panel */}
        <NodeCreatorPanel />

        {/* Node Details Modal (NDV) */}
        <NodeDetailsModal />
      </div>
    </ReactFlowProvider>
  );
}

export default App;
