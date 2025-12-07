/**
 * Schema-Driven Node Architecture
 *
 * This module defines the type system for n8n-style self-describing nodes.
 * Each node exports a `nodeDescription` that defines:
 * - UI fields for form generation
 * - Conditional visibility rules
 * - Dynamic output strategies
 *
 * CRITICAL: Schema property names must exactly match getParameter() calls in execute()
 */

// ============================================
// Field Types
// ============================================

/**
 * Supported property types for node configuration fields
 */
export type NodePropertyType =
  | 'string' // text input
  | 'number' // numeric input
  | 'boolean' // checkbox/toggle
  | 'options' // dropdown select
  | 'json' // code editor (JSON/JavaScript)
  | 'collection'; // array of objects (repeatable groups)

// ============================================
// Conditional Visibility
// ============================================

/**
 * Rules for showing/hiding fields based on other field values
 *
 * @example
 * // Show body field only when method is POST, PUT, or PATCH
 * displayOptions: {
 *   show: { method: ['POST', 'PUT', 'PATCH'] }
 * }
 */
export interface IDisplayOptions {
  /** Show this field only if the specified field has one of these values */
  show?: { [field: string]: unknown[] };
  /** Hide this field if the specified field has one of these values */
  hide?: { [field: string]: unknown[] };
}

// ============================================
// Field Options
// ============================================

/**
 * Option for dropdown/select fields
 */
export interface INodePropertyOption {
  /** Display label shown in dropdown */
  name: string;
  /** Actual value stored when selected */
  value: string | number;
  /** Optional tooltip/description */
  description?: string;
}

/**
 * Type-specific configuration options
 */
export interface INodePropertyTypeOptions {
  // For 'collection' type
  /** Allow adding multiple items (default: true for collection) */
  multipleValues?: boolean;

  // For 'number' type
  /** Minimum allowed value */
  minValue?: number;
  /** Maximum allowed value */
  maxValue?: number;
  /** Step increment for number input */
  step?: number;

  // For 'string' type
  /** Number of rows for textarea */
  rows?: number;
  /** Render as password input */
  password?: boolean;

  // For 'json' type
  /** Syntax highlighting language */
  language?: 'json' | 'javascript';
}

// ============================================
// Single Field Definition
// ============================================

/**
 * Complete definition of a single node configuration field
 *
 * @example
 * {
 *   displayName: 'Headers',
 *   name: 'headers',  // MUST match getParameter() call
 *   type: 'collection',
 *   default: [],
 *   typeOptions: { multipleValues: true },
 *   properties: [
 *     { displayName: 'Name', name: 'name', type: 'string', default: '' },
 *     { displayName: 'Value', name: 'value', type: 'string', default: '' }
 *   ]
 * }
 */
export interface INodeProperty {
  /** Label shown in the UI */
  displayName: string;

  /** Parameter key - MUST match getParameter() call in execute() */
  name: string;

  /** Field type determining UI component */
  type: NodePropertyType;

  /** Default value when field is empty */
  default?: unknown;

  /** Whether field is required for execution */
  required?: boolean;

  /** Placeholder text shown in input */
  placeholder?: string;

  /** Help text / tooltip */
  description?: string;

  // For 'options' type
  /** Available choices for dropdown */
  options?: INodePropertyOption[];

  // For 'collection' type and type-specific config
  /** Type-specific options */
  typeOptions?: INodePropertyTypeOptions;

  /** Nested field definitions (for 'collection' type) */
  properties?: INodeProperty[];

  // Conditional rendering
  /** Conditions for showing/hiding this field */
  displayOptions?: IDisplayOptions;
}

// ============================================
// IO Definitions
// ============================================

/**
 * Port type for visual distinction and connection validation
 * - 'main': Primary data flow (solid circle handle)
 * - 'resource': Helper/auxiliary connection like LLM, Tools, Memory (diamond handle)
 */
export type NodePortType = 'main' | 'resource';

/**
 * Definition of a node output
 */
export interface INodeOutputDefinition {
  /** Internal name used in connections (e.g., 'main', 'true', 'fallback') */
  name: string;
  /** Display label shown in UI */
  displayName: string;
  /**
   * Port type for visual styling and connection validation
   * - 'main': Data flow output (default)
   * - 'resource': Resource output (e.g., LLM model, tool definitions)
   */
  type?: NodePortType;
}

/**
 * Definition of a node input
 */
export interface INodeInputDefinition {
  /** Internal name used in connections */
  name: string;
  /** Display label shown in UI */
  displayName: string;
  /** Whether this input must be connected */
  required?: boolean;
  /**
   * Port type for visual styling and connection validation
   * - 'main': Primary data flow input (default)
   * - 'resource': Helper input like LLM, Tools, Memory
   */
  type?: NodePortType;
  /**
   * Maximum number of connections allowed to this input
   * - undefined or Infinity: unlimited connections
   * - 1: single connection only (e.g., LLM input)
   */
  maxConnections?: number;
}

// ============================================
// Dynamic IO Strategies
// ============================================

/**
 * Strategy for calculating dynamic outputs
 *
 * Used by frontend to determine how many output handles to render
 * without making an API call (zero latency)
 *
 * @example
 * // Switch node: one output per rule + fallback
 * outputStrategy: {
 *   type: 'dynamicFromCollection',
 *   collectionName: 'rules',
 *   addFallback: true
 * }
 */
export interface IOutputStrategy {
  /**
   * Strategy type:
   * - 'static': Fixed outputs defined in `outputs` array
   * - 'dynamicFromCollection': Count items in a collection parameter
   * - 'fixed': Fixed number of outputs specified by `itemCount`
   */
  type: 'static' | 'dynamicFromCollection' | 'fixed';

  /** For 'dynamicFromCollection': parameter name containing the array */
  collectionName?: string;

  /** For 'fixed': number of outputs to create */
  itemCount?: number;

  /** Add +1 output for fallback/else case */
  addFallback?: boolean;
}

/**
 * Strategy for calculating dynamic inputs
 *
 * Used by frontend to determine how many input handles to render
 * for nodes like Merge that accept variable inputs
 *
 * @example
 * // Merge node: inputs determined by connections
 * inputStrategy: {
 *   type: 'dynamicFromConnections',
 *   minInputs: 2
 * }
 */
export interface IInputStrategy {
  /**
   * Strategy type:
   * - 'static': Fixed inputs defined in `inputs` array
   * - 'dynamicFromConnections': Count determined by actual connections
   * - 'fixed': Fixed number of inputs specified by `itemCount`
   */
  type: 'static' | 'dynamicFromConnections' | 'fixed';

  /** Minimum number of inputs required (for dynamic) */
  minInputs?: number;

  /** Maximum number of inputs allowed (for dynamic) */
  maxInputs?: number;

  /** For 'fixed': number of inputs to create */
  itemCount?: number;
}

// ============================================
// Full Node Description
// ============================================

/**
 * Complete UI definition for a node type
 *
 * This is what each node class exports as `static nodeDescription`
 * and what the frontend uses to render configuration forms
 *
 * @example
 * static readonly nodeDescription: INodeTypeDescription = {
 *   name: 'HttpRequest',
 *   displayName: 'HTTP Request',
 *   icon: 'fa:globe',
 *   description: 'Makes HTTP requests to external APIs',
 *   group: ['transform'],
 *   outputs: [{ name: 'main', displayName: 'Response' }],
 *   properties: [...]
 * };
 */
export interface INodeTypeDescription {
  /** Internal type identifier (must match node class `type` property) */
  name: string;

  /** Human-readable name shown in UI */
  displayName: string;

  /**
   * Icon identifier
   * Prefix system: 'fa:globe' for FontAwesome, URL for custom icons
   */
  icon?: string;

  /** Node description shown in UI */
  description: string;

  /** Categorization for node palette (e.g., ['transform'], ['flow'], ['trigger']) */
  group?: string[];

  /** Field definitions for configuration form */
  properties: INodeProperty[];

  /** Input definitions, or 'dynamic' for variable inputs (like Merge) */
  inputs?: INodeInputDefinition[] | 'dynamic';

  /** Output definitions, or 'dynamic' for variable outputs (like Switch) */
  outputs?: INodeOutputDefinition[] | 'dynamic';

  /** Strategy for calculating dynamic inputs (frontend uses this) */
  inputStrategy?: IInputStrategy;

  /** Strategy for calculating dynamic outputs (frontend uses this) */
  outputStrategy?: IOutputStrategy;
}

// ============================================
// API Response Type
// ============================================

/**
 * Node information returned by GET /nodes API
 *
 * Combines INodeTypeDescription with runtime metadata
 */
export interface INodeTypeInfo {
  /** Node type identifier */
  type: string;

  /** Human-readable name */
  displayName: string;

  /** Node description */
  description: string;

  /** Icon identifier */
  icon?: string;

  /** Category groups */
  group?: string[];

  /** Number of inputs (or 'dynamic' if variable) */
  inputCount: number | 'dynamic';

  /** Number of outputs (or 'dynamic' if variable) */
  outputCount: number | 'dynamic';

  /** Field definitions for form rendering */
  properties: INodeProperty[];

  /** Input definitions (when static) */
  inputs?: INodeInputDefinition[];

  /** Output definitions (when static) */
  outputs?: INodeOutputDefinition[];

  /** Strategy for calculating dynamic inputs */
  inputStrategy?: IInputStrategy;

  /** Strategy for calculating dynamic outputs */
  outputStrategy?: IOutputStrategy;
}
