/**
 * DynamicNodeForm - Schema-driven form generation for node parameters
 *
 * This component renders form fields dynamically based on the node's
 * property schema from the API (INodeProperty[]).
 */

import { useState } from 'react';
import { Eye, EyeOff, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import ExpressionEditor from './ExpressionEditor';
import CodeEditor from '@/shared/components/ui/code-editor';

// Type definitions matching the API schema
// These are compatible with INodeProperty from workflow-engine
interface NodePropertyOption {
  name: string;
  value: string | number;
  description?: string;
}

interface NodePropertyTypeOptions {
  password?: boolean;
  rows?: number;
  language?: string;
  minValue?: number;
  maxValue?: number;
  step?: number;
  multipleValues?: boolean;
}

interface DisplayOptions {
  show?: Record<string, string[]>;
  hide?: Record<string, string[]>;
}

// Type for property field types
type NodePropertyType = 'string' | 'number' | 'boolean' | 'options' | 'json' | 'collection';

interface NodeProperty {
  displayName: string;
  name: string;
  type: NodePropertyType;
  default?: unknown;
  required?: boolean;
  placeholder?: string;
  description?: string;
  options?: NodePropertyOption[];
  typeOptions?: NodePropertyTypeOptions;
  properties?: NodeProperty[];
  displayOptions?: DisplayOptions;
}

// Output schema types for expression autocomplete
interface OutputSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'unknown';
  description?: string;
  properties?: Record<string, OutputSchemaProperty>;
  items?: OutputSchemaProperty;
}

interface OutputSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'unknown';
  properties?: Record<string, OutputSchemaProperty>;
  items?: OutputSchemaProperty;
  description?: string;
  passthrough?: boolean;
}

// Export for consumers
export type { NodeProperty, OutputSchema };

interface DynamicNodeFormProps {
  properties: NodeProperty[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  /** All parameter values - used for displayOptions evaluation */
  allValues?: Record<string, unknown>;
  /** Output schema from upstream node for expression autocomplete */
  upstreamSchema?: OutputSchema;
  /** Sample data from upstream node execution for preview */
  sampleData?: Record<string, unknown>[];
}

export default function DynamicNodeForm({
  properties,
  values,
  onChange,
  allValues,
  upstreamSchema,
  sampleData,
}: DynamicNodeFormProps) {
  // Filter properties based on displayOptions
  const visibleProperties = properties.filter((prop) =>
    shouldShowProperty(prop, allValues || values)
  );

  return (
    <div className="space-y-3">
      {visibleProperties.map((property) => (
        <PropertyField
          key={property.name}
          property={property}
          value={values[property.name]}
          onChange={(value) => onChange(property.name, value)}
          allValues={allValues || values}
          upstreamSchema={upstreamSchema}
          sampleData={sampleData}
        />
      ))}
    </div>
  );
}

/**
 * Check if a property should be shown based on displayOptions
 */
function shouldShowProperty(
  property: NodeProperty,
  values: Record<string, unknown>
): boolean {
  const { displayOptions } = property;
  if (!displayOptions) return true;

  // Check 'show' conditions - property shown if ANY condition matches
  if (displayOptions.show) {
    for (const [field, allowedValues] of Object.entries(displayOptions.show)) {
      const currentValue = values[field];
      if (Array.isArray(allowedValues)) {
        if (!allowedValues.includes(currentValue as string)) {
          return false;
        }
      }
    }
  }

  // Check 'hide' conditions - property hidden if ANY condition matches
  if (displayOptions.hide) {
    for (const [field, hiddenValues] of Object.entries(displayOptions.hide)) {
      const currentValue = values[field];
      if (Array.isArray(hiddenValues)) {
        if (hiddenValues.includes(currentValue as string)) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Render a single property field based on its type
 */
interface PropertyFieldProps {
  property: NodeProperty;
  value: unknown;
  onChange: (value: unknown) => void;
  allValues: Record<string, unknown>;
  upstreamSchema?: OutputSchema;
  sampleData?: Record<string, unknown>[];
}

function PropertyField({ property, value, onChange, allValues, upstreamSchema, sampleData }: PropertyFieldProps) {
  const { type } = property;

  switch (type) {
    case 'string':
      return property.typeOptions?.password ? (
        <PasswordField
          property={property}
          value={(value as string) || ''}
          onChange={onChange}
        />
      ) : property.typeOptions?.rows && property.typeOptions.rows > 1 ? (
        <ExpressionEditor
          label={property.displayName}
          value={(value as string) || ''}
          onChange={(v) => onChange(v)}
          placeholder={property.placeholder}
          outputSchema={upstreamSchema}
          sampleData={sampleData}
        />
      ) : (
        <StringField
          property={property}
          value={(value as string) || ''}
          onChange={onChange}
          upstreamSchema={upstreamSchema}
          sampleData={sampleData}
        />
      );

    case 'number':
      return (
        <NumberField
          property={property}
          value={value as number}
          onChange={onChange}
        />
      );

    case 'boolean':
      return (
        <BooleanField
          property={property}
          value={(value as boolean) || false}
          onChange={onChange}
        />
      );

    case 'options':
      return (
        <OptionsField
          property={property}
          value={value as string}
          onChange={onChange}
        />
      );

    case 'json':
      return (
        <JsonField
          property={property}
          value={value}
          onChange={onChange}
        />
      );

    case 'collection':
      return (
        <CollectionField
          property={property}
          value={(value as unknown[]) || []}
          onChange={onChange}
          allValues={allValues}
        />
      );

    default:
      return (
        <div className="text-sm text-muted-foreground">
          Unsupported field type: {type}
        </div>
      );
  }
}

// ============================================
// Field Components
// ============================================

function StringField({
  property,
  value,
  onChange,
  upstreamSchema,
  sampleData,
}: {
  property: NodeProperty;
  value: string;
  onChange: (value: string) => void;
  upstreamSchema?: OutputSchema;
  sampleData?: Record<string, unknown>[];
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">
        {property.displayName}
        {property.required && <span className="text-destructive ml-1">*</span>}
      </label>
      <ExpressionEditor
        value={value}
        onChange={onChange}
        placeholder={property.placeholder}
        outputSchema={upstreamSchema}
        sampleData={sampleData}
      />
      {property.description && (
        <p className="mt-1 text-xs text-muted-foreground">{property.description}</p>
      )}
    </div>
  );
}

function PasswordField({
  property,
  value,
  onChange,
}: {
  property: NodeProperty;
  value: string;
  onChange: (value: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">
        {property.displayName}
        {property.required && <span className="text-destructive ml-1">*</span>}
      </label>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={property.placeholder}
          className="w-full rounded-lg border border-input bg-secondary px-3 py-2 pr-10 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {property.description && (
        <p className="mt-1 text-xs text-muted-foreground">{property.description}</p>
      )}
    </div>
  );
}

function NumberField({
  property,
  value,
  onChange,
}: {
  property: NodeProperty;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  const { typeOptions } = property;
  const min = typeOptions?.minValue;
  const max = typeOptions?.maxValue;
  const step = typeOptions?.step ?? 1;

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">
        {property.displayName}
        {property.required && <span className="text-destructive ml-1">*</span>}
      </label>
      <input
        type="number"
        value={value ?? (typeof property.default === 'number' ? property.default : '')}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {property.description && (
        <p className="mt-1 text-xs text-muted-foreground">{property.description}</p>
      )}
    </div>
  );
}

function BooleanField({
  property,
  value,
  onChange,
}: {
  property: NodeProperty;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
      />
      <div>
        <span className="text-sm text-foreground">{property.displayName}</span>
        {property.description && (
          <p className="text-xs text-muted-foreground">{property.description}</p>
        )}
      </div>
    </label>
  );
}

function OptionsField({
  property,
  value,
  onChange,
}: {
  property: NodeProperty;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
}) {
  const options = property.options || [];

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">
        {property.displayName}
        {property.required && <span className="text-destructive ml-1">*</span>}
      </label>
      <select
        value={String(value ?? property.default ?? '')}
        onChange={(e) => {
          // Try to preserve the original type (number vs string)
          const selectedOption = options.find((o) => String(o.value) === e.target.value);
          onChange(selectedOption?.value ?? e.target.value);
        }}
        className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.name}
          </option>
        ))}
      </select>
      {property.description && (
        <p className="mt-1 text-xs text-muted-foreground">{property.description}</p>
      )}
    </div>
  );
}

function JsonField({
  property,
  value,
  onChange,
}: {
  property: NodeProperty;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const rows = property.typeOptions?.rows ?? 6;
  const language = property.typeOptions?.language ?? 'json';

  // Convert value to string for editing
  const stringValue =
    typeof value === 'string'
      ? value
      : value !== undefined
        ? JSON.stringify(value, null, 2)
        : (property.default as string) ?? '';

  const handleChange = (newValue: string) => {
    // For JavaScript code, keep as string
    if (language === 'javascript') {
      onChange(newValue);
      return;
    }

    // For JSON, try to parse
    try {
      const parsed = JSON.parse(newValue);
      onChange(parsed);
    } catch {
      // Keep as string if not valid JSON
      onChange(newValue);
    }
  };

  // Calculate min height based on rows
  const minHeight = `${Math.max(rows * 24, 100)}px`;
  const maxHeight = `${Math.max(rows * 24, 300)}px`;

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">
        {property.displayName}
        {property.required && <span className="text-destructive ml-1">*</span>}
      </label>
      <CodeEditor
        value={stringValue}
        onChange={handleChange}
        language={language === 'javascript' ? 'javascript' : 'json'}
        placeholder={property.placeholder}
        minHeight={minHeight}
        maxHeight={maxHeight}
      />
      {property.description && (
        <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
          {property.description}
        </p>
      )}
    </div>
  );
}

function CollectionField({
  property,
  value,
  onChange,
  allValues,
}: {
  property: NodeProperty;
  value: unknown[];
  onChange: (value: unknown[]) => void;
  allValues: Record<string, unknown>;
}) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const nestedProperties = property.properties || [];
  const isMultiple = property.typeOptions?.multipleValues !== false;

  const addItem = () => {
    const defaultItem: Record<string, unknown> = {};
    nestedProperties.forEach((prop) => {
      if (prop.default !== undefined) {
        defaultItem[prop.name] = prop.default;
      }
    });
    onChange([...value, defaultItem]);
    setExpandedItems({ ...expandedItems, [value.length]: true });
  };

  const removeItem = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  const updateItem = (index: number, key: string, itemValue: unknown) => {
    const newValue = [...value];
    newValue[index] = { ...(newValue[index] as Record<string, unknown>), [key]: itemValue };
    onChange(newValue);
  };

  const toggleItem = (index: number) => {
    setExpandedItems({ ...expandedItems, [index]: !expandedItems[index] });
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">
        {property.displayName}
      </label>

      <div className="space-y-2">
        {value.map((item, index) => {
          const itemValues = item as Record<string, unknown>;
          const isExpanded = expandedItems[index] ?? true;

          return (
            <div
              key={index}
              className="rounded-lg border border-border bg-secondary/50"
            >
              <div className="flex items-center justify-between px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleItem(index)}
                  className="flex items-center gap-2 text-sm font-medium text-foreground"
                >
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  Item {index + 1}
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="p-1 text-muted-foreground hover:text-destructive rounded"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-border px-3 py-3 space-y-3">
                  {nestedProperties.map((nestedProp) => (
                    <PropertyField
                      key={nestedProp.name}
                      property={nestedProp}
                      value={itemValues[nestedProp.name]}
                      onChange={(val) => updateItem(index, nestedProp.name, val)}
                      allValues={allValues}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isMultiple && (
        <button
          type="button"
          onClick={addItem}
          className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Plus size={14} />
          Add {property.displayName}
        </button>
      )}

      {property.description && (
        <p className="mt-1 text-xs text-muted-foreground">{property.description}</p>
      )}
    </div>
  );
}
