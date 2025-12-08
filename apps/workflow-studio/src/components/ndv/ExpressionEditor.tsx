import { useState, useRef, useEffect, useMemo } from 'react';
import { Code2, X, ChevronDown, Eye, EyeOff } from 'lucide-react';

// Type definitions for output schema (matching workflow-engine)
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

interface ExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  /** Output schema from connected upstream node for autocomplete */
  outputSchema?: OutputSchema;
  /** Sample data from upstream node execution for preview */
  sampleData?: Record<string, unknown>[];
}

// Simple expression syntax highlighting
function highlightExpression(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  // Match {{ expression }} patterns
  const regex = /\{\{([^}]+)\}\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }
    // Add the highlighted expression
    parts.push(
      <span
        key={`expr-${match.index}`}
        className="bg-primary/20 text-primary px-0.5 rounded font-mono"
      >
        {match[0]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : [text];
}

// Resolve expression paths against sample data
function resolveExpression(text: string, sampleData: Record<string, unknown>[] | undefined): string {
  if (!sampleData || sampleData.length === 0) return text;

  const firstItem = sampleData[0];

  return text.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expr) => {
    const trimmedExpr = expr.trim();

    // Handle $json.path expressions
    if (trimmedExpr.startsWith('$json.')) {
      const path = trimmedExpr.slice(6); // Remove '$json.'
      const value = getNestedValue(firstItem, path);
      if (value !== undefined) {
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    }

    // Handle $json directly
    if (trimmedExpr === '$json') {
      return JSON.stringify(firstItem);
    }

    return match; // Return original if can't resolve
  });
}

// Get nested value from object by dot path
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// Base expression suggestions (always available)
const baseExpressionSuggestions = [
  { label: '$json', description: 'Current item JSON data', category: 'data' },
  { label: '$input.item', description: 'Current input item', category: 'data' },
  { label: '$input.all()', description: 'All input items', category: 'data' },
  { label: '$node["NodeName"].json', description: 'Data from specific node', category: 'data' },
  { label: '$now', description: 'Current timestamp', category: 'helper' },
  { label: '$today', description: "Today's date", category: 'helper' },
  { label: '$env.VARIABLE', description: 'Environment variable', category: 'helper' },
  { label: '$runIndex', description: 'Current run index', category: 'helper' },
  { label: '$itemIndex', description: 'Current item index', category: 'helper' },
];

/**
 * Generate field suggestions from an output schema
 */
function generateSchemaFields(
  schema: OutputSchema | OutputSchemaProperty | undefined,
  prefix: string = '$json'
): Array<{ label: string; description: string; category: string }> {
  if (!schema) return [];

  const suggestions: Array<{ label: string; description: string; category: string }> = [];

  if (schema.type === 'object' && schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      const fieldPath = `${prefix}.${key}`;
      const typedProp = prop as OutputSchemaProperty;
      const typeLabel = typedProp.type === 'unknown' ? 'any' : typedProp.type;

      suggestions.push({
        label: fieldPath,
        description: typedProp.description || `${typeLabel} field`,
        category: 'field',
      });

      // Recurse for nested objects (max 2 levels deep)
      if (typedProp.type === 'object' && typedProp.properties && prefix.split('.').length < 3) {
        suggestions.push(...generateSchemaFields(typedProp, fieldPath));
      }
    }
  }

  return suggestions;
}

export default function ExpressionEditor({
  value,
  onChange,
  placeholder = 'Enter value or expression...',
  label,
  outputSchema,
  sampleData,
}: ExpressionEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasExpression = value.includes('{{');
  const canPreview = hasExpression && sampleData && sampleData.length > 0;

  // Resolved/preview value
  const previewValue = useMemo(() => {
    if (!showPreview || !canPreview) return null;
    return resolveExpression(value, sampleData);
  }, [showPreview, canPreview, value, sampleData]);

  // Handle drag events - use refs to avoid re-renders during drag
  const dragCountRef = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current++;
    if (dragCountRef.current === 1) {
      if (e.dataTransfer.types.includes('application/x-field-path') || e.dataTransfer.types.includes('text/plain')) {
        setIsDragOver(true);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    // Don't setState here - fires too frequently
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setIsDragOver(false);

    // Try to get the field path from custom type first, then fall back to text
    let fieldPath = e.dataTransfer.getData('application/x-field-path');
    if (!fieldPath) {
      fieldPath = e.dataTransfer.getData('text/plain');
    }

    if (fieldPath && fieldPath.startsWith('$json')) {
      // Insert the expression at the end of current value (or replace if empty)
      const expression = `{{ ${fieldPath} }}`;
      if (value.trim()) {
        onChange(`${value} ${expression}`);
      } else {
        onChange(expression);
      }

      // Auto-expand to show the inserted expression
      setIsExpanded(true);
    }
  };

  // Generate suggestions from output schema
  const expressionSuggestions = useMemo(() => {
    const schemaFields = generateSchemaFields(outputSchema);

    // If we have schema fields, show them first, then base suggestions
    if (schemaFields.length > 0) {
      return [...schemaFields, ...baseExpressionSuggestions];
    }

    return baseExpressionSuggestions;
  }, [outputSchema]);

  const insertExpression = (expr: string) => {
    const before = value.slice(0, cursorPosition);
    const after = value.slice(cursorPosition);
    const newValue = `${before}{{ ${expr} }}${after}`;
    onChange(newValue);
    setShowSuggestions(false);

    // Focus and set cursor position after the inserted expression
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = cursorPosition + expr.length + 6; // {{ expr }}
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const toggleExpressionMode = () => {
    if (!hasExpression) {
      onChange(`{{ ${value || '$json'} }}`);
    }
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    const handleClickOutside = () => {
      if (showSuggestions) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSuggestions]);

  return (
    <div className="space-y-1">
      {label && (
        <label className="text-xs font-medium text-foreground">{label}</label>
      )}

      <div className="relative">
        {/* Main input with drop zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            flex items-start gap-1 rounded-md border bg-secondary transition-all
            ${isExpanded ? 'border-primary ring-1 ring-primary' : 'border-input'}
            ${hasExpression ? 'bg-primary/5' : ''}
            ${isDragOver ? 'border-primary ring-2 ring-primary/50 bg-primary/10' : ''}
          `}
        >
          {/* Expression toggle button */}
          <button
            type="button"
            onClick={toggleExpressionMode}
            className={`
              flex-shrink-0 p-1.5 rounded-l-md transition-colors
              ${hasExpression ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}
            `}
            title={hasExpression ? 'Expression mode' : 'Enable expression mode'}
          >
            <Code2 size={14} />
          </button>

          {/* Input area */}
          {isExpanded ? (
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onSelect={(e) =>
                setCursorPosition((e.target as HTMLTextAreaElement).selectionStart)
              }
              placeholder={placeholder}
              rows={2}
              className="flex-1 bg-transparent py-1.5 pr-6 text-sm focus:outline-none resize-none font-mono"
            />
          ) : (
            <div
              className="flex-1 py-1.5 pr-6 text-sm cursor-text min-h-[30px] flex items-center"
              onClick={() => {
                setIsExpanded(true);
                // Focus textarea after expansion
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
            >
              {value ? (
                <span className="truncate text-xs">
                  {hasExpression ? highlightExpression(value) : value}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">{placeholder}</span>
              )}
            </div>
          )}

          {/* Preview / Clear / Expand buttons */}
          <div className="flex-shrink-0 flex items-center gap-0.5 p-0.5">
            {/* Preview toggle - only show if we have expressions and sample data */}
            {canPreview && (
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className={`p-0.5 rounded transition-colors ${
                  showPreview
                    ? 'text-amber-500 bg-amber-500/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={showPreview ? 'Show expression' : 'Preview resolved value'}
              >
                {showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            )}
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="p-0.5 text-muted-foreground hover:text-foreground rounded"
                title="Clear"
              >
                <X size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0.5 text-muted-foreground hover:text-foreground rounded"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronDown
                size={12}
                className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {/* Drop indicator overlay */}
          {isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-primary/10 border-2 border-dashed border-primary pointer-events-none">
              <span className="text-xs font-medium text-primary">Drop to insert</span>
            </div>
          )}
        </div>

        {/* Preview display */}
        {showPreview && previewValue && (
          <div className="mt-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1">
            <div className="flex items-center gap-1 mb-0.5">
              <Eye size={10} className="text-amber-500" />
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Preview</span>
            </div>
            <p className="text-xs font-mono text-foreground break-all">{previewValue}</p>
          </div>
        )}

        {/* Expression suggestions dropdown */}
        {isExpanded && (
          <div className="mt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowSuggestions(!showSuggestions);
              }}
              className="text-[10px] text-primary hover:underline"
            >
              Insert variable...
            </button>

            {showSuggestions && (
              <div
                className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-border bg-popover shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Schema fields section */}
                {expressionSuggestions.some((s) => s.category === 'field') && (
                  <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground bg-muted/50 border-b border-border">
                    Fields
                  </div>
                )}
                {expressionSuggestions
                  .filter((s) => s.category === 'field')
                  .map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => insertExpression(suggestion.label)}
                      className="w-full px-2 py-1.5 text-left hover:bg-accent flex items-center justify-between gap-1"
                    >
                      <code className="text-xs font-mono text-primary truncate">
                        {suggestion.label}
                      </code>
                    </button>
                  ))}

                {/* Data variables section */}
                <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground bg-muted/50 border-b border-border">
                  Data
                </div>
                {expressionSuggestions
                  .filter((s) => s.category === 'data')
                  .map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => insertExpression(suggestion.label)}
                      className="w-full px-2 py-1.5 text-left hover:bg-accent flex items-center justify-between gap-1"
                    >
                      <code className="text-xs font-mono text-foreground truncate">
                        {suggestion.label}
                      </code>
                    </button>
                  ))}

                {/* Helper variables section */}
                <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground bg-muted/50 border-b border-border">
                  Helpers
                </div>
                {expressionSuggestions
                  .filter((s) => s.category === 'helper')
                  .map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => insertExpression(suggestion.label)}
                      className="w-full px-2 py-1.5 text-left hover:bg-accent flex items-center justify-between gap-1"
                    >
                      <code className="text-xs font-mono text-foreground truncate">
                        {suggestion.label}
                      </code>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
