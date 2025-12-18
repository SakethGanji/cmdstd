/**
 * Node styling utilities for dynamic group-based colors and sizing
 */

export type NodeGroup = 'trigger' | 'transform' | 'flow' | 'ai' | 'action';

interface NodeStyleConfig {
  group: NodeGroup;
  bgColor: string;
  borderColor: string;
  iconBgColor: string;
  accentColor: string;
  handleColor: string;
}

export interface NodeShapeConfig {
  borderRadiusClass: string;
  accentType: 'left-bar' | 'bottom-bar' | 'diamond' | 'shimmer' | 'none';
}

export interface NodeDimensions {
  width: number;
  height: number;
  minWidth: number;
}

export interface NodeIO {
  name: string;
  displayName?: string;
}

/**
 * Determine node group from type and API-provided group
 */
export function getNodeGroupFromType(type: string, apiGroup?: string[]): NodeGroup {
  // First check API-provided group
  if (apiGroup?.length) {
    const group = apiGroup[0].toLowerCase();
    if (['trigger', 'transform', 'flow', 'ai'].includes(group)) {
      return group as NodeGroup;
    }
  }

  // Fallback: infer from type name
  const triggerTypes = ['Start', 'Webhook', 'Cron', 'ErrorTrigger', 'manualTrigger', 'webhook', 'scheduleTrigger', 'errorTrigger'];
  const flowTypes = ['If', 'Switch', 'Merge', 'Wait', 'SplitInBatches', 'if', 'switch', 'merge', 'wait', 'splitInBatches'];
  const aiTypes = ['LLMChat', 'AIAgent', 'llmChat', 'aiAgent'];

  if (triggerTypes.some(t => type === t || type.toLowerCase().includes(t.toLowerCase()))) return 'trigger';
  if (flowTypes.some(t => type === t)) return 'flow';
  if (aiTypes.some(t => type === t)) return 'ai';

  return 'transform'; // Default for HttpRequest, Set, Code, etc.
}

/**
 * Get CSS variable-based styles for a node group
 */
export function getNodeStyles(group: NodeGroup): NodeStyleConfig {
  const styles: Record<NodeGroup, NodeStyleConfig> = {
    trigger: {
      group: 'trigger',
      bgColor: 'var(--node-trigger-light)',
      borderColor: 'var(--node-trigger-border)',
      iconBgColor: 'var(--node-trigger-icon-bg)',
      accentColor: 'var(--node-trigger)',
      handleColor: 'var(--node-handle)',
    },
    transform: {
      group: 'transform',
      bgColor: 'var(--node-transform-light)',
      borderColor: 'var(--node-transform-border)',
      iconBgColor: 'var(--node-transform-icon-bg)',
      accentColor: 'var(--node-transform)',
      handleColor: 'var(--node-handle)',
    },
    flow: {
      group: 'flow',
      bgColor: 'var(--node-flow-light)',
      borderColor: 'var(--node-flow-border)',
      iconBgColor: 'var(--node-flow-icon-bg)',
      accentColor: 'var(--node-flow)',
      handleColor: 'var(--node-handle)',
    },
    ai: {
      group: 'ai',
      bgColor: 'var(--node-ai-light)',
      borderColor: 'var(--node-ai-border)',
      iconBgColor: 'var(--node-ai-icon-bg)',
      accentColor: 'var(--node-ai)',
      handleColor: 'var(--node-handle)',
    },
    action: {
      group: 'action',
      bgColor: 'var(--node-action-light)',
      borderColor: 'var(--node-action-border)',
      iconBgColor: 'var(--node-action-icon-bg)',
      accentColor: 'var(--node-action)',
      handleColor: 'var(--node-handle)',
    },
  };

  return styles[group];
}

/**
 * Calculate handle positions as percentages for vertical distribution
 * Returns array of top percentages for each handle
 */
export function calculateHandlePositions(handleCount: number): number[] {
  if (handleCount <= 0) return [];
  if (handleCount === 1) return [50]; // Single handle centered

  // Distribute handles evenly with padding from edges
  const padding = 20; // % from top/bottom
  const availableSpace = 100 - (padding * 2);
  const spacing = availableSpace / (handleCount - 1);

  return Array.from({ length: handleCount }, (_, i) =>
    padding + (i * spacing)
  );
}

/**
 * Calculate minimum node height based on handle count
 */
export function calculateNodeMinHeight(inputCount: number, outputCount: number): number {
  const baseHeight = 48; // Base height for icon-only node (label is now outside)
  const handleSpacing = 24; // Pixels per additional handle
  const maxHandles = Math.max(inputCount, outputCount);

  if (maxHandles <= 1) return baseHeight;

  return baseHeight + ((maxHandles - 1) * handleSpacing);
}

/**
 * Get minimap color for a node group
 */
export function getMiniMapColor(group: NodeGroup): string {
  const colors: Record<NodeGroup, string> = {
    trigger: 'var(--node-trigger)',
    transform: 'var(--node-transform)',
    flow: 'var(--node-flow)',
    ai: 'var(--node-ai)',
    action: 'var(--node-action)',
  };

  return colors[group];
}

/**
 * Get shape configuration for a node group (subtle differentiation)
 */
export function getNodeShapeConfig(group: NodeGroup): NodeShapeConfig {
  const shapes: Record<NodeGroup, NodeShapeConfig> = {
    trigger: {
      borderRadiusClass: 'rounded-2xl',
      accentType: 'left-bar',
    },
    transform: {
      borderRadiusClass: 'rounded-xl',
      accentType: 'none',
    },
    flow: {
      borderRadiusClass: 'rounded-xl',
      accentType: 'diamond',
    },
    ai: {
      borderRadiusClass: 'rounded-2xl',
      accentType: 'shimmer',
    },
    action: {
      borderRadiusClass: 'rounded-xl',
      accentType: 'bottom-bar',
    },
  };

  return shapes[group];
}

/**
 * Calculate node dimensions based on handle count (proportional sizing)
 */
export function calculateNodeDimensions(inputCount: number, outputCount: number): NodeDimensions {
  const baseSize = 64; // Square base for icon-only node
  const handleSpacing = 24; // Pixels per additional handle
  const maxHandles = Math.max(inputCount, outputCount);

  if (maxHandles <= 1) {
    return { width: baseSize, height: baseSize, minWidth: baseSize };
  }

  // For multiple handles, grow both dimensions to stay more square
  const extraHandles = maxHandles - 1;
  const height = baseSize + (extraHandles * handleSpacing);

  // Width grows proportionally to maintain balanced aspect ratio
  // For 2 handles: ~1.15x, for 3: ~1.25x, for 4+: ~1.3x
  const widthRatio = Math.min(1.3, 1 + (extraHandles * 0.15));
  const width = Math.round(baseSize * widthRatio);

  return { width, height, minWidth: width };
}
