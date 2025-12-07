import { useEffect, useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { useWorkflowStore } from '../stores/workflowStore';
import { useNodeCreatorStore } from '../stores/nodeCreatorStore';
import { useNDVStore } from '../stores/ndvStore';

interface KeyboardShortcutsOptions {
  onSave?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
  const { onSave } = options;
  const { fitView, zoomIn, zoomOut, getNodes } = useReactFlow();

  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const addStickyNote = useWorkflowStore((s) => s.addStickyNote);

  const closePanel = useNodeCreatorStore((s) => s.closePanel);
  const openPanel = useNodeCreatorStore((s) => s.openPanel);
  const isCreatorOpen = useNodeCreatorStore((s) => s.isOpen);

  const closeNDV = useNDVStore((s) => s.closeNDV);
  const isNDVOpen = useNDVStore((s) => s.isOpen);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Always handle Escape
      if (event.key === 'Escape') {
        if (isNDVOpen) {
          closeNDV();
          event.preventDefault();
          return;
        }
        if (isCreatorOpen) {
          closePanel();
          event.preventDefault();
          return;
        }
      }

      // Don't handle other shortcuts when typing
      if (isInputFocused) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      // Ctrl/Cmd + S: Save workflow
      if (modifierKey && event.key === 's') {
        event.preventDefault();
        onSave?.();
        return;
      }

      // Ctrl/Cmd + Shift + S: Save as (placeholder)
      if (modifierKey && event.shiftKey && event.key === 'S') {
        event.preventDefault();
        console.log('Save As - not implemented');
        return;
      }

      // Ctrl/Cmd + 0: Fit view
      if (modifierKey && event.key === '0') {
        event.preventDefault();
        fitView({ padding: 0.2, duration: 200 });
        return;
      }

      // Ctrl/Cmd + =: Zoom in
      if (modifierKey && (event.key === '=' || event.key === '+')) {
        event.preventDefault();
        zoomIn({ duration: 200 });
        return;
      }

      // Ctrl/Cmd + -: Zoom out
      if (modifierKey && event.key === '-') {
        event.preventDefault();
        zoomOut({ duration: 200 });
        return;
      }

      // Ctrl/Cmd + A: Select all (prevent default, would select all text)
      if (modifierKey && event.key === 'a') {
        event.preventDefault();
        // TODO: Implement select all nodes
        return;
      }

      // N: Add new node (when no modifiers)
      if (event.key === 'n' && !modifierKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        openPanel('regular');
        return;
      }

      // T: Add trigger node
      if (event.key === 't' && !modifierKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        openPanel('trigger');
        return;
      }

      // S: Add sticky note
      if (event.key === 's' && !modifierKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        // Get center of viewport for sticky note placement
        const nodes = getNodes();
        const centerX = nodes.length > 0
          ? nodes.reduce((sum, n) => sum + n.position.x, 0) / nodes.length
          : 400;
        const centerY = nodes.length > 0
          ? nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length
          : 300;
        addStickyNote({ x: centerX + 100, y: centerY - 100 });
        return;
      }

      // Delete/Backspace: Delete selected node
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeId) {
        event.preventDefault();
        deleteNode(selectedNodeId);
        return;
      }

      // F: Fit view
      if (event.key === 'f' && !modifierKey) {
        event.preventDefault();
        fitView({ padding: 0.2, duration: 200 });
        return;
      }

      // Space + drag: Pan (handled by ReactFlow, but we can show hints)

      // ?: Show keyboard shortcuts help (Shift + /)
      if (event.shiftKey && event.key === '?') {
        event.preventDefault();
        // TODO: Show shortcuts modal
        console.log('Keyboard shortcuts help - not implemented');
        return;
      }
    },
    [
      onSave,
      fitView,
      zoomIn,
      zoomOut,
      deleteNode,
      selectedNodeId,
      closePanel,
      openPanel,
      closeNDV,
      isCreatorOpen,
      isNDVOpen,
      addStickyNote,
      getNodes,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    shortcuts: [
      { key: 'Ctrl/Cmd + S', description: 'Save workflow' },
      { key: 'Ctrl/Cmd + 0', description: 'Fit to view' },
      { key: 'Ctrl/Cmd + +', description: 'Zoom in' },
      { key: 'Ctrl/Cmd + -', description: 'Zoom out' },
      { key: 'N', description: 'Add new node' },
      { key: 'T', description: 'Add trigger node' },
      { key: 'S', description: 'Add sticky note' },
      { key: 'F', description: 'Fit to view' },
      { key: 'Delete/Backspace', description: 'Delete selected node' },
      { key: 'Escape', description: 'Close panel/modal' },
    ],
  };
}
