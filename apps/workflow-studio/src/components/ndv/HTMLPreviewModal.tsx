import { X, ExternalLink } from 'lucide-react';

interface HTMLPreviewModalProps {
  html: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function HTMLPreviewModal({ html, isOpen, onClose }: HTMLPreviewModalProps) {
  if (!isOpen) return null;

  const handleOpenInNewTab = () => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 flex h-[90vh] w-[90vw] max-w-[1400px] flex-col overflow-hidden rounded-xl bg-card shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold text-foreground">HTML Preview</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenInNewTab}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Open in new tab"
            >
              <ExternalLink size={14} />
              <span>New Tab</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content - iframe */}
        <div className="flex-1 overflow-hidden bg-white">
          <iframe
            srcDoc={html}
            sandbox="allow-same-origin"
            className="h-full w-full border-0"
            title="HTML Preview"
          />
        </div>
      </div>
    </div>
  );
}
