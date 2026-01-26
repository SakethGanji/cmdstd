import { useCallback, useMemo } from 'react';
import { X, Search, ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useNodeCreatorStore } from '../../stores/nodeCreatorStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import { generateNodeName, getExistingNodeNames } from '../../lib/workflowTransform';
import { useNodeTypes, getNodeIcon } from '../../hooks/useNodeTypes';
import NodeItem from './NodeItem';
import type { NodeDefinition, WorkflowNodeData, SubnodeType, SubnodeSlotDefinition, OutputStrategy } from '../../types/workflow';
import type { NodeGroup, NodeIO } from '../../lib/nodeStyles';

// Property definition from API
interface ApiProperty {
  name: string;
  displayName: string;
  type: string;
  default?: unknown;
  [key: string]: unknown;
}

// Extended node definition with API metadata for dynamic UI
interface ExtendedNodeDefinition extends NodeDefinition {
  group?: NodeGroup;
  inputCount?: number;
  outputCount?: number;
  inputs?: NodeIO[];
  outputs?: NodeIO[];
  // Subnode metadata (for subnodes themselves)
  isSubnode?: boolean;
  subnodeType?: SubnodeType;
  providesToSlot?: string;
  // Subnode slots (for parent nodes like AI Agent)
  subnodeSlots?: SubnodeSlotDefinition[];
  // Output strategy for dynamic output nodes
  outputStrategy?: OutputStrategy;
  // Properties with defaults
  properties?: ApiProperty[];
}

export default function NodeCreatorPanel() {
  const {
    isOpen,
    view,
    search,
    sourceNodeId,
    sourceHandleId,
    dropPosition,
    subnodeSlotContext,
    closePanel,
    setView,
    setSearch,
    clearConnectionContext,
    clearSubnodeContext,
  } = useNodeCreatorStore();

  const { addNode, addSubnode, nodes, onConnect } = useWorkflowStore();

  // Fetch node types from API
  const { data: apiNodes, isLoading, isError } = useNodeTypes();

  // Transform API nodes to ExtendedNodeDefinition format with dynamic UI metadata
  const { triggerNodes, regularNodes, subnodeNodes } = useMemo(() => {
    if (!apiNodes) return { triggerNodes: [], regularNodes: [], subnodeNodes: [] };

    const triggers: ExtendedNodeDefinition[] = [];
    const regular: ExtendedNodeDefinition[] = [];
    const subnodes: ExtendedNodeDefinition[] = [];

    apiNodes.forEach((node) => {
      const isTrigger = node.group?.includes('trigger');
      const isSubnode = node.isSubnode === true;
      const category = node.group?.[0] || 'other';

      // Map API category to UI category
      const categoryMap: Record<string, NodeDefinition['category']> = {
        trigger: 'trigger',
        transform: 'transform',
        flow: 'flow',
        ai: 'ai',
        helper: 'helper',
        other: 'action',
      };

      // Parse inputs/outputs from API
      const inputs: NodeIO[] = (node.inputs || []).map((input: { name: string; displayName?: string }) => ({
        name: input.name,
        displayName: input.displayName || input.name,
      }));

      const outputs: NodeIO[] = (node.outputs || []).map((output: { name: string; displayName?: string }) => ({
        name: output.name,
        displayName: output.displayName || output.name,
      }));

      // Calculate input/output counts (handle dynamic output nodes)
      const inputCount = typeof node.inputCount === 'number' ? node.inputCount : inputs.length;
      const outputCount = typeof node.outputCount === 'number'
        ? node.outputCount
        : (node.outputCount === 'dynamic' ? outputs.length || 1 : outputs.length);

      const nodeDef: ExtendedNodeDefinition = {
        type: node.type, // Backend type (PascalCase) - used everywhere
        name: node.type, // Same as type
        displayName: node.displayName,
        description: node.description,
        icon: getNodeIcon(node.type, node.icon),
        category: categoryMap[category] || 'action',
        subcategory: getCategoryLabel(category),
        // Dynamic UI metadata
        group: category as NodeGroup,
        inputCount,
        outputCount,
        inputs,
        outputs,
        // Subnode metadata (for subnodes)
        isSubnode,
        subnodeType: node.subnodeType as SubnodeType | undefined,
        providesToSlot: node.providesToSlot,
        // Subnode slots (for parent nodes like AI Agent)
        subnodeSlots: node.subnodeSlots as SubnodeSlotDefinition[] | undefined,
        // Output strategy for dynamic output nodes (like Switch)
        outputStrategy: node.outputStrategy as OutputStrategy | undefined,
        // Properties with defaults
        properties: node.properties as ApiProperty[] | undefined,
      };

      if (isSubnode) {
        subnodes.push(nodeDef);
      } else if (isTrigger) {
        triggers.push(nodeDef);
      } else {
        regular.push(nodeDef);
      }
    });

    return { triggerNodes: triggers, regularNodes: regular, subnodeNodes: subnodes };
  }, [apiNodes]);

  // Get the right nodes based on view
  const availableNodes = useMemo(() => {
    if (view === 'trigger') {
      return triggerNodes;
    }
    if (view === 'subnode' && subnodeSlotContext) {
      // Filter subnodes by the slot type they can connect to
      return subnodeNodes.filter((node) => node.subnodeType === subnodeSlotContext.slotType);
    }
    return regularNodes;
  }, [view, triggerNodes, regularNodes, subnodeNodes, subnodeSlotContext]);

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

  // Group nodes by subcategory
  const groupedNodes = useMemo(() => {
    const grouped: Record<string, NodeDefinition[]> = {};

    filteredNodes.forEach((node) => {
      const key = node.subcategory || node.category;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(node);
    });

    return grouped;
  }, [filteredNodes]);

  // Calculate position for new node
  const getNewNodePosition = useCallback(() => {
    // If we have a drop position (from dragging a connection), use it
    if (dropPosition) {
      // Snap to grid (20px)
      return {
        x: Math.round(dropPosition.x / 20) * 20,
        y: Math.round(dropPosition.y / 20) * 20,
      };
    }

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
  }, [nodes, sourceNodeId, dropPosition]);

  // Handle node selection
  const handleNodeSelect = useCallback(
    (nodeDef: ExtendedNodeDefinition) => {
      const position = getNewNodePosition();
      const newNodeId = `node-${Date.now()}`;

      // Generate unique node name based on backend type
      // nodeDef.name contains the backend type (e.g., 'HttpRequest', 'Start')
      const existingNames = getExistingNodeNames(nodes as any);
      const nodeName = generateNodeName(nodeDef.name, existingNames);

      // Extract defaults from properties
      const defaultParams: Record<string, unknown> = {};
      if (nodeDef.properties) {
        for (const prop of nodeDef.properties) {
          if (prop.default !== undefined) {
            defaultParams[prop.name] = prop.default;
          }
        }
      }

      // Backend now returns computed default outputs, so we use them directly.
      // No need to recalculate here - the API already computed outputs based on
      // property defaults (e.g., Switch with numberOfOutputs=2 returns 3 outputs).
      const nodeData: WorkflowNodeData = {
        name: nodeName,           // Unique name for backend connections
        label: nodeDef.displayName,  // Display label in UI
        type: nodeDef.type,       // UI type (camelCase)
        icon: nodeDef.icon,
        description: nodeDef.description,
        parameters: defaultParams,
        continueOnFail: false,
        retryOnFail: 0,
        retryDelay: 1000,
        // Dynamic UI metadata from API (already computed with defaults)
        group: nodeDef.group,
        inputCount: nodeDef.inputCount,
        outputCount: nodeDef.outputCount,
        inputs: nodeDef.inputs,
        outputs: nodeDef.outputs,
        // Output strategy for dynamic recalculation when user changes params
        outputStrategy: nodeDef.outputStrategy,
        // Subnode slots for parent nodes (like AI Agent)
        subnodeSlots: nodeDef.subnodeSlots,
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
          sourceHandle: sourceHandleId,
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
      sourceHandleId,
      view,
    ]
  );

  // Handle subnode selection (from slot + button)
  const handleSubnodeSelect = useCallback(
    (nodeDef: ExtendedNodeDefinition) => {
      if (!subnodeSlotContext || !nodeDef.subnodeType) return;

      // Extract defaults from properties
      const defaultParams: Record<string, unknown> = {};
      if (nodeDef.properties) {
        for (const prop of nodeDef.properties) {
          if (prop.default !== undefined) {
            defaultParams[prop.name] = prop.default;
          }
        }
      }

      addSubnode(
        subnodeSlotContext.parentNodeId,
        subnodeSlotContext.slotName,
        {
          type: nodeDef.name,
          label: nodeDef.displayName,
          icon: nodeDef.icon,
          subnodeType: nodeDef.subnodeType,
          properties: defaultParams,
        }
      );

      clearSubnodeContext();
      closePanel();
    },
    [addSubnode, closePanel, clearSubnodeContext, subnodeSlotContext]
  );

  // Choose the right handler based on view
  const handleNodeClick = useCallback(
    (nodeDef: ExtendedNodeDefinition) => {
      if (view === 'subnode') {
        handleSubnodeSelect(nodeDef);
      } else {
        handleNodeSelect(nodeDef);
      }
    },
    [view, handleNodeSelect, handleSubnodeSelect]
  );

  if (!isOpen) return null;

  // Get slot type display name for subnode view
  const slotTypeLabels: Record<string, string> = {
    model: 'Chat Model',
    memory: 'Memory',
    tool: 'Tool',
  };

  const title =
    view === 'trigger'
      ? 'What triggers this workflow?'
      : view === 'subnode' && subnodeSlotContext
      ? `Select ${slotTypeLabels[subnodeSlotContext.slotType] || 'Subnode'}`
      : 'What happens next?';

  const subtitle =
    view === 'trigger'
      ? 'Select a trigger to start your workflow'
      : view === 'subnode' && subnodeSlotContext
      ? `Choose a ${subnodeSlotContext.slotType} to attach`
      : 'Add a node to continue your workflow';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/60"
        onClick={closePanel}
      />

      {/* Panel */}
      <div className="fixed right-4 top-4 bottom-4 z-50 flex w-[420px] flex-col rounded-2xl overflow-hidden glass-card">
        {/* Header */}
        <div className="border-b border-border px-5 py-5 bg-[var(--card-gradient)]">
          <div className="flex items-center justify-between">
            {view !== 'trigger' && view !== 'subnode' && (
              <button
                onClick={() => setView('trigger')}
                className="mr-3 rounded-xl p-2 hover:bg-accent transition-colors"
              >
                <ArrowLeft size={18} className="text-muted-foreground" />
              </button>
            )}
            {view === 'subnode' && (
              <button
                onClick={closePanel}
                className="mr-3 rounded-xl p-2 hover:bg-accent transition-colors"
              >
                <ArrowLeft size={18} className="text-muted-foreground" />
              </button>
            )}
            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground">
                {title}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
            <button
              onClick={closePanel}
              className="rounded-xl p-2 hover:bg-accent transition-colors"
            >
              <X size={18} className="text-muted-foreground" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input)] py-2.5 pl-11 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Node List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            // Loading state
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Loading nodes...</p>
            </div>
          ) : isError ? (
            // Error state
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-destructive mb-2">Failed to load nodes</p>
              <p className="text-xs text-muted-foreground">Please check your connection and try again</p>
            </div>
          ) : search ? (
            // Flat list when searching
            <div className="space-y-2">
              {filteredNodes.map((node) => (
                <NodeItem
                  key={node.type}
                  node={node}
                  onClick={() => handleNodeClick(node)}
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
                    <h3 className="label-caps">
                      Popular
                    </h3>
                    {triggerNodes.slice(0, 3).map((node) => (
                      <NodeItem
                        key={node.type}
                        node={node}
                        onClick={() => handleNodeClick(node)}
                      />
                    ))}
                  </div>
                  {triggerNodes.length > 3 && (
                    <div className="space-y-2">
                      <h3 className="label-caps">
                        Other Triggers
                      </h3>
                      {triggerNodes.slice(3).map((node) => (
                        <NodeItem
                          key={node.type}
                          node={node}
                          onClick={() => handleNodeClick(node)}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                // Regular view - grouped by category
                Object.entries(groupedNodes).map(([category, categoryNodes]) => (
                  <div key={category} className="space-y-2">
                    <h3 className="flex items-center label-caps">
                      {category}
                      <ChevronRight size={12} className="ml-1" />
                    </h3>
                    {categoryNodes.map((node) => (
                      <NodeItem
                        key={node.type}
                        node={node}
                        onClick={() => handleNodeClick(node)}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 bg-[var(--card-gradient)]">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="glass-badge text-[9px] px-2 py-0.5 font-mono">Esc</kbd> to close
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * Get a human-readable label for a category
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    trigger: 'Triggers',
    transform: 'Transform Data',
    flow: 'Flow',
    ai: 'AI',
    helper: 'Helpers',
    other: 'Other',
  };
  return labels[category] || category.charAt(0).toUpperCase() + category.slice(1);
}
