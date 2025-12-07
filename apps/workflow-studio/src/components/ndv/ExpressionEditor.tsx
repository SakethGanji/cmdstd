import { useState, useRef, useEffect, useMemo } from 'react';
import { Code2, X, ChevronDown } from 'lucide-react';

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
}: ExpressionEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasExpression = value.includes('{{');

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
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}

      <div className="relative">
        {/* Main input */}
        <div
          className={`
            flex items-start gap-2 rounded-lg border bg-secondary transition-all
            ${isExpanded ? 'border-primary ring-1 ring-primary' : 'border-input'}
            ${hasExpression ? 'bg-primary/5' : ''}
          `}
        >
          {/* Expression toggle button */}
          <button
            type="button"
            onClick={toggleExpressionMode}
            className={`
              flex-shrink-0 p-2 rounded-l-lg transition-colors
              ${hasExpression ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}
            `}
            title={hasExpression ? 'Expression mode' : 'Enable expression mode'}
          >
            <Code2 size={16} />
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
              rows={3}
              className="flex-1 bg-transparent py-2 pr-8 text-sm focus:outline-none resize-none font-mono"
            />
          ) : (
            <div
              className="flex-1 py-2 pr-8 text-sm cursor-text min-h-[36px] flex items-center"
              onClick={() => setIsExpanded(true)}
            >
              {value ? (
                <span className="truncate">
                  {hasExpression ? highlightExpression(value) : value}
                </span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
          )}

          {/* Clear / Expand buttons */}
          <div className="flex-shrink-0 flex items-center gap-1 p-1">
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
                title="Clear"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-muted-foreground hover:text-foreground rounded"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronDown
                size={14}
                className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Expression suggestions dropdown */}
        {isExpanded && (
          <div className="mt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowSuggestions(!showSuggestions);
              }}
              className="text-xs text-primary hover:underline"
            >
              Insert expression variable...
            </button>

            {showSuggestions && (
              <div
                className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-border bg-popover shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Schema fields section */}
                {expressionSuggestions.some((s) => s.category === 'field') && (
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-b border-border">
                    Available Fields
                  </div>
                )}
                {expressionSuggestions
                  .filter((s) => s.category === 'field')
                  .map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => insertExpression(suggestion.label)}
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between gap-2"
                    >
                      <code className="text-sm font-mono text-primary">
                        {suggestion.label}
                      </code>
                      <span className="text-xs text-muted-foreground truncate">
                        {suggestion.description}
                      </span>
                    </button>
                  ))}

                {/* Data variables section */}
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-b border-border">
                  Data Variables
                </div>
                {expressionSuggestions
                  .filter((s) => s.category === 'data')
                  .map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => insertExpression(suggestion.label)}
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between gap-2"
                    >
                      <code className="text-sm font-mono text-foreground">
                        {suggestion.label}
                      </code>
                      <span className="text-xs text-muted-foreground truncate">
                        {suggestion.description}
                      </span>
                    </button>
                  ))}

                {/* Helper variables section */}
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-b border-border">
                  Helpers
                </div>
                {expressionSuggestions
                  .filter((s) => s.category === 'helper')
                  .map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => insertExpression(suggestion.label)}
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between gap-2"
                    >
                      <code className="text-sm font-mono text-foreground">
                        {suggestion.label}
                      </code>
                      <span className="text-xs text-muted-foreground truncate">
                        {suggestion.description}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expression mode hint */}
      {hasExpression && !isExpanded && (
        <p className="text-xs text-muted-foreground">
          Expression mode: Click to edit
        </p>
      )}
    </div>
  );
}
