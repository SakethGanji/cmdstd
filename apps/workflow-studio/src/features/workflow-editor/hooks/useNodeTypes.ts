/**
 * Hook to fetch and cache node type definitions from the API
 *
 * This replaces the hardcoded node definitions in nodeCreatorStore
 * and provides schema-driven UI generation.
 */

import { useQuery } from '@tanstack/react-query';
import { nodesApi } from '@/shared/lib/api';

/**
 * Fetch all available node types with their schemas
 */
export function useNodeTypes() {
  return useQuery({
    queryKey: ['nodes'],
    queryFn: nodesApi.list,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Map backend node type to UI icon
 */
export function getNodeIcon(type: string, iconFromApi?: string): string {
  // If API provides icon, use it (strip fa: prefix if present)
  if (iconFromApi) {
    return iconFromApi.replace('fa:', '');
  }

  // Fallback icon mapping
  const iconMap: Record<string, string> = {
    Start: 'mouse-pointer',
    Webhook: 'webhook',
    Cron: 'clock',
    ErrorTrigger: 'alert-triangle',
    HttpRequest: 'globe',
    Set: 'pen',
    Code: 'code',
    If: 'git-branch',
    Switch: 'route',
    Merge: 'git-merge',
    Wait: 'clock',
    SplitInBatches: 'layers',
    LLMChat: 'message-square',
    AIAgent: 'bot',
  };

  return iconMap[type] || 'code';
}

/**
 * Map backend type (PascalCase) to UI type (camelCase)
 */
export function backendTypeToUIType(backendType: string): string {
  const map: Record<string, string> = {
    Start: 'manualTrigger',
    Webhook: 'webhook',
    Cron: 'scheduleTrigger',
    ErrorTrigger: 'errorTrigger',
    HttpRequest: 'httpRequest',
    Set: 'set',
    Code: 'code',
    If: 'if',
    Switch: 'switch',
    Merge: 'merge',
    Wait: 'wait',
    SplitInBatches: 'splitInBatches',
    LLMChat: 'llmChat',
    AIAgent: 'aiAgent',
    ReadFile: 'readFile',
    PandasExplore: 'pandasExplore',
    HTMLDisplay: 'htmlDisplay',
  };
  return map[backendType] || backendType.charAt(0).toLowerCase() + backendType.slice(1);
}

/**
 * Map UI type (camelCase) to backend type (PascalCase)
 */
export function uiTypeToBackendType(uiType: string): string {
  const map: Record<string, string> = {
    manualTrigger: 'Start',
    webhook: 'Webhook',
    scheduleTrigger: 'Cron',
    errorTrigger: 'ErrorTrigger',
    httpRequest: 'HttpRequest',
    set: 'Set',
    code: 'Code',
    if: 'If',
    switch: 'Switch',
    merge: 'Merge',
    wait: 'Wait',
    splitInBatches: 'SplitInBatches',
    llmChat: 'LLMChat',
    aiAgent: 'AIAgent',
    readFile: 'ReadFile',
    pandasExplore: 'PandasExplore',
    htmlDisplay: 'HTMLDisplay',
  };
  return map[uiType] || uiType.charAt(0).toUpperCase() + uiType.slice(1);
}

/**
 * Check if a node type is a trigger (no inputs)
 */
export function isTriggerNode(type: string): boolean {
  const triggerTypes = ['Start', 'Webhook', 'Cron', 'ErrorTrigger', 'manualTrigger', 'webhook', 'scheduleTrigger', 'errorTrigger'];
  return triggerTypes.includes(type);
}
