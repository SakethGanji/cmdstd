import { useMemo } from 'react';

interface RunDataDisplayProps {
  data: Record<string, unknown>[];
  mode: 'table' | 'json' | 'schema';
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

  // Generate schema from data
  const schema = useMemo(() => {
    const schemaObj: Record<string, string> = {};
    data.forEach((item) => {
      Object.entries(item).forEach(([key, value]) => {
        if (!schemaObj[key]) {
          schemaObj[key] = typeof value;
        }
      });
    });
    return schemaObj;
  }, [data]);

  if (mode === 'json') {
    return (
      <div className="rounded-lg bg-neutral-900 p-4">
        <pre className="overflow-auto text-sm text-green-400">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  }

  if (mode === 'schema') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-neutral-600">
          {data.length} item{data.length !== 1 ? 's' : ''}
        </p>
        <div className="rounded-lg border border-neutral-200 bg-white">
          {Object.entries(schema).map(([key, type]) => (
            <div
              key={key}
              className="flex items-center justify-between border-b border-neutral-100 px-4 py-2 last:border-b-0"
            >
              <span className="font-mono text-sm text-neutral-800">{key}</span>
              <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-600">
                {type}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Table mode (default)
  return (
    <div className="overflow-auto rounded-lg border border-neutral-200 bg-white">
      <table className="min-w-full divide-y divide-neutral-200">
        <thead className="bg-neutral-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500">
              #
            </th>
            {columns.map((column) => (
              <th
                key={column}
                className="px-4 py-2 text-left text-xs font-semibold text-neutral-500"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {data.map((item, index) => (
            <tr key={index} className="hover:bg-neutral-50">
              <td className="whitespace-nowrap px-4 py-2 text-sm text-neutral-400">
                {index}
              </td>
              {columns.map((column) => (
                <td
                  key={column}
                  className="whitespace-nowrap px-4 py-2 text-sm text-neutral-700"
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
