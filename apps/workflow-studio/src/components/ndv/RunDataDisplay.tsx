import { useMemo, useState } from 'react';
import { GripVertical, ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';

interface RunDataDisplayProps {
  data: Record<string, unknown>[];
  mode: 'table' | 'json' | 'schema';
}

// Type for nested schema structure
interface SchemaNode {
  type: string;
  children?: Record<string, SchemaNode>;
  path: string;
}

export default function RunDataDisplay({ data, mode }: RunDataDisplayProps) {
  // Get all unique keys from all items
  const columns = useMemo(() => {
    const keys = new Set<string>();
    data.forEach((item) => {
      Object.keys(item).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [data]);

  // Generate nested schema from data for tree view
  const schema = useMemo(() => {
    const buildSchema = (
      obj: Record<string, unknown>,
      basePath: string = '$json'
    ): Record<string, SchemaNode> => {
      const result: Record<string, SchemaNode> = {};

      Object.entries(obj).forEach(([key, value]) => {
        const path = `${basePath}.${key}`;
        const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;

        if (type === 'object' && value !== null) {
          result[key] = {
            type,
            path,
            children: buildSchema(value as Record<string, unknown>, path),
          };
        } else if (type === 'array' && Array.isArray(value) && value.length > 0) {
          const firstItem = value[0];
          if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
            result[key] = {
              type,
              path,
              children: buildSchema(firstItem as Record<string, unknown>, `${path}[0]`),
            };
          } else {
            result[key] = { type, path };
          }
        } else {
          result[key] = { type, path };
        }
      });

      return result;
    };

    // Merge schema from all items
    const merged: Record<string, unknown> = {};
    data.forEach((item) => {
      Object.entries(item).forEach(([key, value]) => {
        if (!(key in merged)) {
          merged[key] = value;
        }
      });
    });

    return buildSchema(merged);
  }, [data]);

  // Handle drag start for field
  const handleDragStart = (e: React.DragEvent, fieldPath: string) => {
    e.dataTransfer.setData('text/plain', fieldPath);
    e.dataTransfer.setData('application/x-field-path', fieldPath);
    e.dataTransfer.effectAllowed = 'copy';

    // Create a custom drag image
    const dragEl = document.createElement('div');
    dragEl.textContent = `{{ ${fieldPath} }}`;
    dragEl.style.cssText = 'position: absolute; top: -1000px; background: #1e1e1e; color: #10b981; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 12px;';
    document.body.appendChild(dragEl);
    e.dataTransfer.setDragImage(dragEl, 0, 0);
    setTimeout(() => document.body.removeChild(dragEl), 0);
  };

  if (mode === 'json') {
    return (
      <div className="rounded-lg bg-foreground p-4">
        <pre className="overflow-auto text-sm text-emerald-400">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  }

  if (mode === 'schema') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          {data.length} item{data.length !== 1 ? 's' : ''} · Drag fields to map them
        </p>
        <div className="rounded-lg border border-border bg-card">
          {Object.entries(schema).map(([key, node]) => (
            <SchemaFieldRow
              key={key}
              name={key}
              node={node}
              depth={0}
              onDragStart={handleDragStart}
            />
          ))}
        </div>
      </div>
    );
  }

  // Table mode (default)
  return (
    <div className="overflow-auto rounded-lg border border-border bg-card">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
              #
            </th>
            {columns.map((column) => (
              <th
                key={column}
                draggable
                onDragStart={(e) => handleDragStart(e, `$json.${column}`)}
                className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground cursor-grab hover:bg-primary/10 hover:text-primary transition-colors select-none group"
                title={`Drag to insert {{ $json.${column} }}`}
              >
                <span className="flex items-center gap-1">
                  <GripVertical size={12} className="opacity-0 group-hover:opacity-50 flex-shrink-0" />
                  {column}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((item, index) => (
            <tr key={index} className="hover:bg-accent">
              <td className="whitespace-nowrap px-4 py-2 text-sm text-muted-foreground">
                {index}
              </td>
              {columns.map((column) => (
                <td
                  key={column}
                  className="whitespace-nowrap px-4 py-2 text-sm text-foreground"
                >
                  {formatValue(item[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

// Type badge colors
const typeBadgeColors: Record<string, string> = {
  string: 'bg-emerald-500/10 text-emerald-500',
  number: 'bg-blue-500/10 text-blue-500',
  boolean: 'bg-purple-500/10 text-purple-500',
  object: 'bg-orange-500/10 text-orange-500',
  array: 'bg-yellow-500/10 text-yellow-500',
  null: 'bg-gray-500/10 text-gray-500',
};

// Schema field row component with expand/collapse for nested fields
interface SchemaFieldRowProps {
  name: string;
  node: SchemaNode;
  depth: number;
  onDragStart: (e: React.DragEvent, path: string) => void;
}

function SchemaFieldRow({ name, node, depth, onDragStart }: SchemaFieldRowProps) {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const [copied, setCopied] = useState(false);
  const hasChildren = node.children && Object.keys(node.children).length > 0;
  const paddingLeft = depth * 16 + 12;

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    const expression = `{{ ${node.path} }}`;
    navigator.clipboard.writeText(expression);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, node.path)}
        className="flex items-center justify-between border-b border-border last:border-b-0 hover:bg-primary/5 cursor-grab transition-colors group"
        style={{ paddingLeft }}
      >
        <div className="flex items-center gap-1 py-2 pr-2 flex-1 min-w-0">
          {/* Drag handle */}
          <GripVertical size={14} className="opacity-30 group-hover:opacity-70 flex-shrink-0 text-muted-foreground" />

          {/* Expand/collapse for nested */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-0.5 hover:bg-accent rounded flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-muted-foreground" />
              ) : (
                <ChevronRight size={14} className="text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-5" /> // Spacer
          )}

          {/* Field name */}
          <span className="font-mono text-sm text-foreground truncate">{name}</span>
        </div>

        <div className="flex items-center gap-2 pr-3 py-2">
          {/* Copy button */}
          <button
            onClick={handleCopyPath}
            className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
            title={`Copy {{ ${node.path} }}`}
          >
            {copied ? (
              <Check size={14} className="text-emerald-500" />
            ) : (
              <Copy size={14} className="text-muted-foreground" />
            )}
          </button>

          {/* Type badge */}
          <span
            className={`rounded px-2 py-0.5 font-mono text-xs flex-shrink-0 ${typeBadgeColors[node.type] || 'bg-muted text-muted-foreground'}`}
          >
            {node.type}
          </span>
        </div>
      </div>

      {/* Render children if expanded */}
      {hasChildren && isExpanded && (
        <>
          {Object.entries(node.children!).map(([childKey, childNode]) => (
            <SchemaFieldRow
              key={childKey}
              name={childKey}
              node={childNode}
              depth={depth + 1}
              onDragStart={onDragStart}
            />
          ))}
        </>
      )}
    </>
  );
}
