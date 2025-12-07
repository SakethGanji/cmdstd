import { useState, useRef, useEffect } from 'react';
import { Code2, X, ChevronDown } from 'lucide-react';

interface ExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
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

// Common expression suggestions
const expressionSuggestions = [
  { label: '$json', description: 'Current item JSON data' },
  { label: '$json.fieldName', description: 'Access a specific field' },
  { label: '$input.item', description: 'Current input item' },
  { label: '$input.all()', description: 'All input items' },
  { label: '$node["NodeName"].json', description: 'Data from specific node' },
  { label: '$now', description: 'Current timestamp' },
  { label: '$today', description: "Today's date" },
  { label: '$env.VARIABLE', description: 'Environment variable' },
  { label: '$runIndex', description: 'Current run index' },
  { label: '$itemIndex', description: 'Current item index' },
];

export default function ExpressionEditor({
  value,
  onChange,
  placeholder = 'Enter value or expression...',
  label,
}: ExpressionEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasExpression = value.includes('{{');

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
                className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-border bg-popover shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {expressionSuggestions.map((suggestion) => (
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
