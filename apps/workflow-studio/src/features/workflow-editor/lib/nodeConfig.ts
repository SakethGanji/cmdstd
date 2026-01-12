/**
 * Centralized Node Configuration
 *
 * The backend is the SINGLE source of truth for node metadata.
 * This file contains only:
 * - Fallback icons (when backend doesn't provide one)
 * - Trigger type detection
 * - Group normalization
 *
 * Node types use backend PascalCase names everywhere (Start, Set, HttpRequest, etc.)
 * No type conversion is needed.
 */

// ============================================================================
// Fallback Icons (only used when backend doesn't provide icon)
// ============================================================================

/**
 * Fallback icon mapping by node type.
 * Used ONLY when the backend doesn't provide an icon.
 * New nodes should define icons in the backend.
 */
export const FALLBACK_ICONS: Record<string, string> = {
  // Triggers
  Start: 'mouse-pointer',
  Webhook: 'webhook',
  Cron: 'clock',
  ErrorTrigger: 'alert-triangle',
  ChatInput: 'message',
  // Transform
  Set: 'pen',
  Code: 'code',
  HttpRequest: 'globe',
  ReadFile: 'file',
  PandasExplore: 'chart-bar',
  ObjectRead: 'download',
  ObjectWrite: 'upload',
  // Flow
  If: 'git-branch',
  Switch: 'route',
  Merge: 'git-merge',
  Wait: 'clock',
  SplitInBatches: 'layers',
  ExecuteWorkflow: 'sitemap',
  // AI
  LLMChat: 'message-square',
  AIAgent: 'bot',
  // Output
  HTMLDisplay: 'monitor',
  ChatOutput: 'message-square',
};

/**
 * Get icon for a node type.
 * Prefers API-provided icon, falls back to FALLBACK_ICONS.
 */
export function getNodeIcon(nodeType: string, iconFromApi?: string): string {
  if (iconFromApi) {
    // Strip fa: prefix if present (backend uses Font Awesome naming)
    return iconFromApi.replace('fa:', '');
  }
  return FALLBACK_ICONS[nodeType] ?? 'code';
}

// ============================================================================
// Trigger Detection
// ============================================================================

/**
 * Node types that are triggers (no inputs).
 */
export const TRIGGER_TYPES = new Set([
  'Start',
  'Webhook',
  'Cron',
  'ErrorTrigger',
  'ChatInput',
]);

/**
 * Check if a node type is a trigger.
 */
export function isTriggerType(type: string): boolean {
  return TRIGGER_TYPES.has(type);
}

// ============================================================================
// Node Groups (for styling)
// ============================================================================

/**
 * Valid node groups for styling.
 * These match the CSS variables defined in the theme.
 */
export type NodeGroup = 'trigger' | 'transform' | 'flow' | 'ai' | 'action' | 'output';

/**
 * Get node group from API-provided group array.
 * The backend returns groups as an array (e.g., ["flow"]).
 * Returns first valid group or defaults to 'transform'.
 */
export function normalizeNodeGroup(apiGroup?: string[] | null): NodeGroup {
  if (!apiGroup?.length) return 'transform';

  const group = apiGroup[0].toLowerCase();

  // Map API groups to valid NodeGroup values
  const validGroups: NodeGroup[] = ['trigger', 'transform', 'flow', 'ai', 'action', 'output'];
  if (validGroups.includes(group as NodeGroup)) {
    return group as NodeGroup;
  }

  // Special mappings
  if (group === 'ui') return 'output';
  if (group === 'input') return 'trigger';
  if (group === 'helper') return 'action';

  return 'transform';
}
