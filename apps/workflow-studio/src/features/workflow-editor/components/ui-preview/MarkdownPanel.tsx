import { useUIModeStore } from '../../stores/uiModeStore';
import { FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export function MarkdownPanel() {
  const markdownContent = useUIModeStore((s) => s.markdownContent);

  return (
    <div className="flex flex-col h-full rounded-lg border bg-background">
      <div className="px-4 py-2 border-b flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Markdown Preview</h3>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {markdownContent ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{markdownContent}</ReactMarkdown>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Markdown output will appear here...
          </div>
        )}
      </div>
    </div>
  );
}
