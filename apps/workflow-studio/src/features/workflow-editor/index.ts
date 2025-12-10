/**
 * Workflow Editor Feature
 *
 * This module exports the public API for the workflow editor feature.
 * Other features should import from this index file rather than reaching
 * into internal paths.
 */

// Components
export { default as WorkflowCanvas } from './components/canvas/WorkflowCanvas';
export { default as NodeCreatorPanel } from './components/node-creator/NodeCreatorPanel';
export { default as NodeDetailsModal } from './components/ndv/NodeDetailsModal';
export { default as WorkflowNavbar } from './components/workflow-navbar/WorkflowNavbar';
export { default as ExecutionLogsPanel } from './components/execution-logs/ExecutionLogsPanel';

// Stores
export { useWorkflowStore } from './stores/workflowStore';
export { useNDVStore } from './stores/ndvStore';
export { useNodeCreatorStore } from './stores/nodeCreatorStore';

// Hooks
export { useSaveWorkflow, useExecuteWorkflow, useToggleWorkflowActive } from './hooks/useWorkflowApi';
export { useNodeTypes, getNodeIcon, backendTypeToUIType, uiTypeToBackendType, isTriggerNode } from './hooks/useNodeTypes';
export { useExecutionStream } from './hooks/useExecutionStream';

// Types
export type {
  WorkflowNodeData,
  NodeDefinition,
  NodeExecutionData,
  StickyNoteData,
} from './types/workflow';
