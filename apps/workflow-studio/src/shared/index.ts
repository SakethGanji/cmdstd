/**
 * Shared Module
 *
 * This module exports shared components, hooks, and utilities
 * that are used across multiple features.
 */

// Components
export { AppSidebar } from './components/app-sidebar';
export { ThemeProvider, useTheme } from './components/theme-provider';
export { ErrorBoundary } from './components/ErrorBoundary';

// UI Components
export * from './components/ui/button';
export * from './components/ui/sidebar';
export * from './components/ui/sheet';
export * from './components/ui/dropdown-menu';
export * from './components/ui/tooltip';
export * from './components/ui/avatar';
export * from './components/ui/switch';

// Hooks
export { useIsMobile } from './hooks/use-mobile';

// Utilities
export { cn } from './lib/utils';
export { workflowsApi, nodesApi } from './lib/api';
