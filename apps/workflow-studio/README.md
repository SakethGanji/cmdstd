# Workflow Studio

A React Flow-based workflow editor, inspired by n8n's workflow automation UI.

## n8n Architecture Reference

This document maps n8n's Vue.js workflow editor to our React Flow implementation.

---

## n8n Source Code Location

All n8n frontend code is located at:
```
apps/temp/n8n/packages/frontend/editor-ui/src/
```

---

## 1. Canvas (Workflow Editor)

### n8n Implementation (VueFlow)

| Component | Path | Description |
|-----------|------|-------------|
| `Canvas.vue` | `features/workflows/canvas/components/Canvas.vue` | Main canvas using VueFlow library |
| `WorkflowCanvas.vue` | `features/workflows/canvas/components/WorkflowCanvas.vue` | Wrapper that manages workflow data mapping |
| `useCanvasMapping.ts` | `features/workflows/canvas/composables/useCanvasMapping.ts` | Transforms workflow data to VueFlow format |

**Key VueFlow Features Used:**
- Snap-to-grid (20px grid)
- Pan on scroll/drag
- Zoom controls
- Minimap
- Custom node/edge types
- Keyboard shortcuts

### React Flow Equivalent

```tsx
// Our implementation
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState
} from 'reactflow';
```

| n8n (VueFlow) | React Flow |
|---------------|------------|
| `<VueFlow>` | `<ReactFlow>` |
| `@vue-flow/minimap` | `<MiniMap>` |
| `snap-to-grid` | `snapToGrid={true} snapGrid={[20, 20]}` |
| `pan-on-scroll` | `panOnScroll={true}` |
| Custom node types | `nodeTypes` prop |
| Custom edge types | `edgeTypes` prop |

---

## 2. "Add First Step" Button (Empty Canvas State)

### n8n Implementation

| Component | Path | Description |
|-----------|------|-------------|
| `CanvasNodeAddNodes.vue` | `features/workflows/canvas/components/elements/nodes/render-types/CanvasNodeAddNodes.vue` | Legacy single button |
| `CanvasNodeChoicePrompt.vue` | `features/workflows/canvas/components/elements/nodes/render-types/CanvasNodeChoicePrompt.vue` | Modern two-button variant |

**UI Elements:**
- Dashed border button with "+" icon (100x100px)
- Text: "Add first step..." below
- Optional: "or use a template" link

**On Click Action:**
```typescript
// n8n store action
nodeCreatorStore.openNodeCreatorForTriggerNodes(NODE_CREATOR_OPEN_SOURCES.TRIGGER_PLACEHOLDER_BUTTON);
```

### React Flow Equivalent

Create a custom node type `addNodes`:
```tsx
const nodeTypes = {
  addNodes: AddNodesButton,
  // ... other node types
};
```

---

## 3. Node Creator Panel (Side Panel)

### n8n Implementation

| Component | Path | Description |
|-----------|------|-------------|
| `NodeCreator.vue` | `features/shared/nodeCreator/components/NodeCreator.vue` | Main slide-out container |
| `NodesListPanel.vue` | `features/shared/nodeCreator/components/Panel/NodesListPanel.vue` | Panel content renderer |
| `SearchBar.vue` | `features/shared/nodeCreator/components/Panel/SearchBar.vue` | Search input |
| `NodesMode.vue` | `features/shared/nodeCreator/components/Modes/NodesMode.vue` | Node list rendering |
| `ActionsMode.vue` | `features/shared/nodeCreator/components/Modes/ActionsMode.vue` | Action list rendering |
| `viewsData.ts` | `features/shared/nodeCreator/views/viewsData.ts` | View definitions (Trigger/Regular/AI) |

**Panel Behavior:**
- Fixed position on right side of screen
- Width: `$node-creator-width` (CSS variable)
- Slide-in animation from right
- Scrim/overlay behind panel
- Close on outside click or Escape

### Panel Views

#### TriggerView ("What triggers this workflow?")

i18n key: `nodeCreator.triggerHelperPanel.selectATrigger`

**Items shown:**
1. Manual Trigger - "Trigger manually"
2. App Trigger Nodes (subcategory)
3. Schedule Trigger - "On a schedule"
4. Webhook - "On webhook call"
5. Form Trigger - "On form submission"
6. Execute Workflow Trigger - "When called by another workflow"
7. Chat Trigger - "On chat message"
8. Other Trigger Nodes (subcategory)

#### RegularView ("What happens next?")

i18n key: `nodeCreator.triggerHelperPanel.whatHappensNext`

**Items shown:**
1. AI Nodes (view link)
2. App Regular Nodes (subcategory)
3. Transform Data (subcategory with sections)
   - Popular: Set, Code, Data Table, DateTime, AI Transform
   - Add or Remove: Filter, Remove Duplicates, Split Out, Limit
   - Combine: Summarize, Aggregate, Merge
   - Convert: HTML, Markdown, XML, Crypto, Extract from File, etc.
4. Flow Control (subcategory)
   - Popular: Filter, If, Split In Batches, Merge
5. Helpers (subcategory)
   - Popular: HTTP Request, Webhook, Code, Data Table
6. Human in the Loop (subcategory)
7. Add another trigger (view link)

### React Equivalent

```tsx
// Slide-out panel component
<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetContent side="right" className="w-[400px]">
    <SheetHeader>
      <SheetTitle>{title}</SheetTitle>
    </SheetHeader>
    <SearchBar value={search} onChange={setSearch} />
    <NodeList items={filteredItems} onSelect={handleSelect} />
  </SheetContent>
</Sheet>
```

---

## 4. Node Handles (Connection Points)

### n8n Implementation

| Component | Path | Description |
|-----------|------|-------------|
| `CanvasHandleRenderer.vue` | `features/workflows/canvas/components/elements/handles/CanvasHandleRenderer.vue` | Handle wrapper |
| `CanvasHandleMainOutput.vue` | `features/workflows/canvas/components/elements/handles/render-types/CanvasHandleMainOutput.vue` | Output handle with + button |
| `CanvasHandleMainInput.vue` | `features/workflows/canvas/components/elements/handles/render-types/CanvasHandleMainInput.vue` | Input handle |
| `CanvasHandlePlus.vue` | `features/workflows/canvas/components/elements/handles/render-types/parts/CanvasHandlePlus.vue` | The "+" add node button |

**Handle Types:**
- Main (primary data flow)
- AI connections (Tool, Document, Memory, etc.)

**Plus Button Behavior:**
- Shows on hover of output handle
- On click: Opens NodeCreator with `RegularView`
- Stores connection context for auto-connect

### React Flow Equivalent

```tsx
import { Handle, Position } from 'reactflow';

// Custom handle with plus button
<Handle type="source" position={Position.Right}>
  <button className="plus-button" onClick={handleAddNode}>
    <Plus size={12} />
  </button>
</Handle>
```

---

## 5. Node Details View (NDV) - Three-Panel Editor

### n8n Implementation

| Component | Path | Description |
|-----------|------|-------------|
| `NodeDetailsView.vue` | `features/ndv/shared/views/NodeDetailsView.vue` | Main modal container |
| `NDVDraggablePanels.vue` | `features/ndv/panel/components/NDVDraggablePanels.vue` | Three-panel layout manager |
| `InputPanel.vue` | `features/ndv/panel/components/InputPanel.vue` | Left panel - input data |
| `NodeSettings.vue` | `features/ndv/settings/components/NodeSettings.vue` | Center panel - node config |
| `OutputPanel.vue` | `features/ndv/panel/components/OutputPanel.vue` | Right panel - output data |
| `RunData.vue` | `features/ndv/runData/components/RunData.vue` | Data visualization component |

**Layout:**
```
┌──────────────┬─────────────────────────┬──────────────────┐
│  InputPanel  │     NodeSettings        │   OutputPanel    │
│              │                         │                  │
│  - RunData   │  - Parameter forms      │  - RunData       │
│  - Node      │  - Credential selector  │  - Pin data      │
│    selector  │  - Execute button       │  - Toggle logs   │
│              │                         │                  │
└──────────────┴─────────────────────────┴──────────────────┘
```

**Panel Features:**
- Resizable via drag handles
- Positions saved to localStorage
- Main panel min-width: 310px
- Side panels have margins: 80px

### React Equivalent

```tsx
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="max-w-[90vw] h-[90vh]">
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={25}>
        <InputPanel />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={50}>
        <NodeSettings />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={25}>
        <OutputPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  </DialogContent>
</Dialog>
```

---

## 6. State Management

### n8n Implementation (Pinia)

| Store | Path | Purpose |
|-------|------|---------|
| `nodeCreator.store.ts` | `features/shared/nodeCreator/nodeCreator.store.ts` | Panel state, node filtering |
| `workflows.store.ts` | `app/stores/workflows.store.ts` | Nodes, connections, execution |
| `ndv.store.ts` | `features/ndv/shared/ndv.store.ts` | Active node, panel dimensions |
| `ui.store.ts` | `app/stores/ui.store.ts` | Global UI state |
| `nodeTypes.store.ts` | `app/stores/nodeTypes.store.ts` | Available node type definitions |

### React Equivalent (Zustand)

```tsx
// stores/workflowStore.ts
import { create } from 'zustand';

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;

  addNode: (node: Node) => void;
  updateNode: (id: string, data: Partial<Node>) => void;
  deleteNode: (id: string) => void;
  setSelectedNode: (id: string | null) => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  addNode: (node) => set((state) => ({
    nodes: [...state.nodes, node]
  })),
  // ...
}));
```

---

## 7. i18n Keys Reference

Key text strings from `packages/frontend/@n8n/i18n/src/locales/en.json`:

```json
{
  "nodeView.canvasAddButton.addFirstStep": "Add first step...",
  "nodeView.canvasAddButton.addATriggerNodeBeforeExecuting": "Add a trigger node before executing",

  "nodeCreator.triggerHelperPanel.selectATrigger": "What triggers this workflow?",
  "nodeCreator.triggerHelperPanel.whatHappensNext": "What happens next?",
  "nodeCreator.triggerHelperPanel.addAnotherTrigger": "Add another trigger",

  "nodeCreator.triggerHelperPanel.manualTriggerDisplayName": "Trigger manually",
  "nodeCreator.triggerHelperPanel.scheduleTriggerDisplayName": "On a schedule",
  "nodeCreator.triggerHelperPanel.webhookTriggerDisplayName": "On webhook call",
  "nodeCreator.triggerHelperPanel.formTriggerDisplayName": "On form submission",
  "nodeCreator.triggerHelperPanel.chatTriggerDisplayName": "On chat message",

  "nodeCreator.searchBar.searchNodes": "Search nodes...",

  "ndv.backToCanvas": "Back to canvas"
}
```

---

## 8. Component Mapping Summary

| Feature | n8n Vue Component | React Component (to build) |
|---------|-------------------|---------------------------|
| Canvas | `Canvas.vue` | `WorkflowCanvas.tsx` |
| Add Node Button | `CanvasNodeAddNodes.vue` | `AddNodesButton.tsx` |
| Workflow Node | `CanvasNodeDefault.vue` | `WorkflowNode.tsx` |
| Node Creator Panel | `NodeCreator.vue` | `NodeCreatorPanel.tsx` |
| Node List | `NodesListPanel.vue` | `NodeList.tsx` |
| Node Item | `NodeItem.vue` | `NodeItem.tsx` |
| Node Details Modal | `NodeDetailsView.vue` | `NodeDetailsModal.tsx` |
| Three-Panel Layout | `NDVDraggablePanels.vue` | `NDVPanels.tsx` |
| Input Panel | `InputPanel.vue` | `InputPanel.tsx` |
| Output Panel | `OutputPanel.vue` | `OutputPanel.tsx` |
| Node Settings | `NodeSettings.vue` | `NodeSettings.tsx` |
| Run Data Display | `RunData.vue` | `RunDataDisplay.tsx` |

---

## 9. Proposed File Structure

```
apps/workflow-studio/src/
├── components/
│   ├── canvas/
│   │   ├── WorkflowCanvas.tsx        # Main React Flow canvas
│   │   ├── nodes/
│   │   │   ├── AddNodesButton.tsx    # Empty state "Add first step"
│   │   │   ├── WorkflowNode.tsx      # Standard workflow node
│   │   │   └── StickyNote.tsx        # Sticky note node
│   │   ├── edges/
│   │   │   └── WorkflowEdge.tsx      # Custom edge with add button
│   │   └── handles/
│   │       └── NodeHandle.tsx        # Custom handle with + button
│   │
│   ├── node-creator/
│   │   ├── NodeCreatorPanel.tsx      # Slide-out panel container
│   │   ├── NodeList.tsx              # Scrollable node list
│   │   ├── NodeItem.tsx              # Individual node item
│   │   ├── CategoryItem.tsx          # Collapsible category
│   │   └── SearchBar.tsx             # Search input
│   │
│   ├── ndv/                          # Node Details View
│   │   ├── NodeDetailsModal.tsx      # Modal wrapper
│   │   ├── NDVPanels.tsx             # Three-panel layout
│   │   ├── InputPanel.tsx            # Left panel
│   │   ├── OutputPanel.tsx           # Right panel
│   │   ├── NodeSettings.tsx          # Center panel
│   │   └── RunDataDisplay.tsx        # Data visualization
│   │
│   └── ui/                           # shadcn/ui components
│       ├── button.tsx
│       ├── sheet.tsx
│       ├── dialog.tsx
│       └── resizable.tsx
│
├── stores/
│   ├── workflowStore.ts              # Nodes, edges, execution
│   ├── nodeCreatorStore.ts           # Panel state
│   └── ndvStore.ts                   # Node details state
│
├── types/
│   ├── workflow.ts                   # Workflow types
│   ├── node.ts                       # Node types
│   └── execution.ts                  # Execution types
│
├── lib/
│   ├── nodeRegistry.ts               # Available node definitions
│   └── utils.ts                      # Utility functions
│
└── App.tsx                           # Main app entry
```

---

## 10. Implementation Phases

### Phase 1: Canvas Foundation
- [ ] Set up React Flow with basic configuration
- [ ] Create `AddNodesButton` node type for empty state
- [ ] Create `WorkflowNode` node type
- [ ] Add basic zoom/pan controls

### Phase 2: Node Creator Panel
- [ ] Create slide-out panel component
- [ ] Implement TriggerView (initial node selection)
- [ ] Implement RegularView (subsequent nodes)
- [ ] Add search functionality
- [ ] Connect to canvas for node creation

### Phase 3: Node Connections
- [ ] Custom handles with + button
- [ ] Edge creation flow
- [ ] Auto-connect new nodes to source

### Phase 4: Node Details View (NDV)
- [ ] Modal with three-panel layout
- [ ] Resizable panels
- [ ] Input panel with data display
- [ ] Node settings form
- [ ] Output panel with data display

### Phase 5: Execution
- [ ] Execute node button
- [ ] Display run data
- [ ] Error handling display

---

## Dependencies to Add

```bash
npm install reactflow zustand @radix-ui/react-dialog @radix-ui/react-sheet react-resizable-panels
```

Or with your package manager:
```bash
pnpm add reactflow zustand @radix-ui/react-dialog react-resizable-panels
```
