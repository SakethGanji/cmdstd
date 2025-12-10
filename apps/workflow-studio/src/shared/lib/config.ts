/**
 * Environment Configuration
 *
 * Determines backend URLs based on the current hostname.
 * Each environment can have multiple backends.
 */

interface Backends {
  workflow: string;    // Workflow engine API
  // Add more backends as needed:
  // auth: string;
  // analytics: string;
}

// Add your environments here
const ENVIRONMENTS: Record<string, Backends> = {
  'localhost': {
    workflow: 'http://localhost:3001',
  },
  '127.0.0.1': {
    workflow: 'http://localhost:3001',
  },

  // Development
  // 'dev.yourapp.com': {
  //   workflow: 'https://workflow-dev.yourapp.com',
  //   auth: 'https://auth-dev.yourapp.com',
  // },

  // UAT / Staging
  // 'uat.yourapp.com': {
  //   workflow: 'https://workflow-uat.yourapp.com',
  //   auth: 'https://auth-uat.yourapp.com',
  // },

  // Production
  // 'app.yourapp.com': {
  //   workflow: 'https://workflow.yourapp.com',
  //   auth: 'https://auth.yourapp.com',
  // },
};

// Default: same origin for all backends
const DEFAULT_BACKENDS: Backends = {
  workflow: '',
};

function getBackends(): Backends {
  const hostname = window.location.hostname;
  return ENVIRONMENTS[hostname] ?? DEFAULT_BACKENDS;
}

export const backends = getBackends();
