/**
 * tRPC Client Setup
 *
 * Configures the tRPC client to communicate with the workflow-engine backend.
 * Uses @tanstack/react-query for caching and state management.
 */

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';

// Import AppRouter type from workflow-engine
// The workflow-engine package exports its types via the "types" field
import type { AppRouter } from 'workflow-engine';

/**
 * Create typed tRPC hooks for React
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Get the API base URL
 * In development, Vite proxies /trpc to the backend
 * In production, use the configured API URL
 */
function getBaseUrl(): string {
  // In development, use relative URL (Vite proxy handles it)
  if (import.meta.env.DEV) {
    return '/trpc';
  }

  // In production, use environment variable or default
  return import.meta.env.VITE_API_URL || 'http://localhost:3000/trpc';
}

/**
 * Create tRPC client with HTTP batch link
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: getBaseUrl(),
        // Optional: Add headers for authentication
        // headers() {
        //   return {
        //     Authorization: `Bearer ${getToken()}`,
        //   };
        // },
      }),
    ],
  });
}
