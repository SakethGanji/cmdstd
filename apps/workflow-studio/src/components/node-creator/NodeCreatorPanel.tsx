import { useCallback, useMemo } from 'react';
import { X, Search, ArrowLeft, ChevronRight } from 'lucide-react';
import {
  useNodeCreatorStore,
  triggerNodes,
  regularNodes,
  getNodesByCategory,
} from '../../stores/nodeCreatorStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import { generateNodeName, getExistingNodeNames } from '../../lib/workflowTransform';
import NodeItem from './NodeItem';
import type { NodeDefinition, WorkflowNodeData } from '../../types/workflow';

export default function NodeCreatorPanel() {
  const {
    isOpen,
    view,
    search,
    sourceNodeId,
    closePanel,
    setView,
    setSearch,
    clearConnectionContext,
  } = useNodeCreatorStore();

  const { addNode, nodes, onConnect } = useWorkflowStore();

  // Get the right nodes based on view
  const availableNodes = useMemo(() => {
    return view === 'trigger' ? triggerNodes : regularNodes;
  }, [view]);

  // Filter nodes by search
  const filteredNodes = useMemo(() => {
    if (!search) return availableNodes;
    const lowerSearch = search.toLowerCase();
    return availableNodes.filter(
      (node) =>
        node.displayName.toLowerCase().includes(lowerSearch) ||
        node.description.toLowerCase().includes(lowerSearch)
    );
  }, [availableNodes, search]);

  // Group nodes by category
  const groupedNodes = useMemo(
    () => getNodesByCategory(filteredNodes),
    [filteredNodes]
  );

  // Calculate position for new node
  const getNewNodePosition = useCallback(() => {
    if (sourceNodeId) {
      // Position to the right of source node
      const sourceNode = nodes.find((n) => n.id === sourceNodeId);
      if (sourceNode) {
        return {
          x: sourceNode.position.x + 250,
          y: sourceNode.position.y,
        };
      }
    }

    // Find a good position for new node
    if (nodes.length === 0 || (nodes.length === 1 && nodes[0].type === 'addNodes')) {
      return { x: 250, y: 200 };
    }

    // Place to the right of the rightmost node
    const maxX = Math.max(...nodes.map((n) => n.position.x));
    const avgY =
      nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length;

    return { x: maxX + 250, y: avgY };
  }, [nodes, sourceNodeId]);

  // Handle node selection
  const handleNodeSelect = useCallback(
    (nodeDef: NodeDefinition) => {
      const position = getNewNodePosition();
      const newNodeId = `node-${Date.now()}`;

      // Generate unique node name based on backend type
      // nodeDef.name contains the backend type (e.g., 'HttpRequest', 'Start')
      const existingNames = getExistingNodeNames(nodes as any);
      const nodeName = generateNodeName(nodeDef.name, existingNames);

      const nodeData: WorkflowNodeData = {
        name: nodeName,           // Unique name for backend connections
        label: nodeDef.displayName,  // Display label in UI
        type: nodeDef.type,       // UI type (camelCase)
        icon: nodeDef.icon,
        description: nodeDef.description,
        parameters: {},
        continueOnFail: false,
        retryOnFail: 0,
        retryDelay: 1000,
      };

      const newNode = {
        id: newNodeId,
        type: 'workflowNode',
        position,
        data: nodeData,
      };

      addNode(newNode);

      // Auto-connect if we have a source node
      if (sourceNodeId) {
        onConnect({
          source: sourceNodeId,
          target: newNodeId,
          sourceHandle: null,
          targetHandle: null,
        });
      }

      // If this was a trigger, switch to regular view for next node
      if (view === 'trigger') {
        setView('regular');
      }

      clearConnectionContext();
      closePanel();
    },
    [
      addNode,
      closePanel,
      clearConnectionContext,
      getNewNodePosition,
      nodes,
      onConnect,
      setView,
      sourceNodeId,
      view,
    ]
  );

  if (!isOpen) return null;

  const title =
    view === 'trigger'
      ? 'What triggers this workflow?'
      : 'What happens next?';

  const subtitle =
    view === 'trigger'
      ? 'Select a trigger to start your workflow'
      : 'Add a node to continue your workflow';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
        onClick={closePanel}
      />

      {/* Panel */}
      <div className="fixed right-2 top-2 bottom-2 z-50 flex w-[400px] flex-col bg-card shadow-2xl border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center justify-between">
            {view !== 'trigger' && (
              <button
                onClick={() => setView('trigger')}
                className="mr-2 rounded-md p-1 hover:bg-accent"
              >
                <ArrowLeft size={20} className="text-muted-foreground" />
              </button>
            )}
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">
                {title}
              </h2>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <button
              onClick={closePanel}
              className="rounded-md p-1 hover:bg-accent"
            >
              <X size={20} className="text-muted-foreground" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-secondary py-2 pl-10 pr-4 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>
        </div>

        {/* Node List */}
        <div className="flex-1 overflow-y-auto p-4">
          {search ? (
            // Flat list when searching
            <div className="space-y-2">
              {filteredNodes.map((node) => (
                <NodeItem
                  key={node.type}
                  node={node}
                  onClick={() => handleNodeSelect(node)}
                />
              ))}
              {filteredNodes.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No nodes found matching "{search}"
                </p>
              )}
            </div>
          ) : (
            // Grouped list when not searching
            <div className="space-y-6">
              {view === 'trigger' ? (
                // Trigger view - flat list with sections
                <>
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Popular
                    </h3>
                    {triggerNodes.slice(0, 3).map((node) => (
                      <NodeItem
                        key={node.type}
                        node={node}
                        onClick={() => handleNodeSelect(node)}
                      />
                    ))}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Other Triggers
                    </h3>
                    {triggerNodes.slice(3).map((node) => (
                      <NodeItem
                        key={node.type}
                        node={node}
                        onClick={() => handleNodeSelect(node)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                // Regular view - grouped by category
                Object.entries(groupedNodes).map(([category, nodes]) => (
                  <div key={category} className="space-y-2">
                    <h3 className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {category}
                      <ChevronRight size={14} className="ml-1" />
                    </h3>
                    {nodes.map((node) => (
                      <NodeItem
                        key={node.type}
                        node={node}
                        onClick={() => handleNodeSelect(node)}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="rounded-md bg-muted px-1 py-0.5 font-mono">Esc</kbd> to close
          </p>
        </div>
      </div>
    </>
  );
}
