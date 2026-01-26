import { memo, useState, useRef, useEffect } from 'react';
import { type NodeProps, NodeResizer } from 'reactflow';
import { Trash2 } from 'lucide-react';
import { useWorkflowStore } from '../../../stores/workflowStore';
import type { StickyNoteData } from '../../../types/workflow';

const colorClasses: Record<string, { bg: string; border: string; text: string; resizer: string }> = {
  yellow: {
    bg: 'bg-yellow-100 dark:bg-yellow-800',
    border: 'border-yellow-300 dark:border-yellow-600',
    text: 'text-yellow-900 dark:text-yellow-100',
    resizer: '#ca8a04',
  },
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-800',
    border: 'border-blue-300 dark:border-blue-600',
    text: 'text-blue-900 dark:text-blue-100',
    resizer: '#2563eb',
  },
  green: {
    bg: 'bg-green-100 dark:bg-green-800',
    border: 'border-green-300 dark:border-green-600',
    text: 'text-green-900 dark:text-green-100',
    resizer: '#16a34a',
  },
  pink: {
    bg: 'bg-pink-100 dark:bg-pink-800',
    border: 'border-pink-300 dark:border-pink-600',
    text: 'text-pink-900 dark:text-pink-100',
    resizer: '#db2777',
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-800',
    border: 'border-purple-300 dark:border-purple-600',
    text: 'text-purple-900 dark:text-purple-100',
    resizer: '#9333ea',
  },
};

function StickyNote({ id, data, selected }: NodeProps<StickyNoteData>) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(data.content || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateStickyNote = useWorkflowStore((s) => s.updateStickyNote);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);

  const colors = colorClasses[data.color || 'yellow'];
  const width = data.width || 200;
  const height = data.height || 150;

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    updateStickyNote(id, { content });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setContent(data.content || '');
    }
  };

  const handleColorChange = (color: StickyNoteData['color']) => {
    updateStickyNote(id, { color });
  };

  const handleResize = (_: unknown, params: { width: number; height: number }) => {
    updateStickyNote(id, { width: params.width, height: params.height });
  };

  return (
    <div
      className={`
        relative rounded-lg border-2 shadow-md
        ${colors.bg} ${colors.border}
        ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      `}
      style={{ width, height }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={150}
        minHeight={100}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.resizer,
          border: 'none',
        }}
        lineStyle={{
          borderColor: colors.resizer,
          borderWidth: 1,
        }}
        onResize={handleResize}
      />
      {/* Color picker - show on selection */}
      {selected && (
        <div className="absolute -top-10 left-0 flex gap-1 rounded-lg bg-popover p-1 shadow-md border border-border">
          {Object.keys(colorClasses).map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color as StickyNoteData['color'])}
              className={`
                w-5 h-5 rounded-full border-2 transition-transform
                ${colorClasses[color].bg} ${colorClasses[color].border}
                ${data.color === color ? 'scale-110 ring-2 ring-primary' : 'hover:scale-105'}
              `}
            />
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={() => deleteNode(id)}
            className="p-0.5 rounded hover:bg-destructive/10 text-destructive"
            title="Delete note"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Content */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`
            nodrag w-full h-full p-3 bg-transparent resize-none
            ${colors.text} placeholder:text-current placeholder:opacity-50
            focus:outline-none
          `}
          placeholder="Add a note..."
        />
      ) : (
        <div
          onDoubleClick={() => setIsEditing(true)}
          className={`
            w-full h-full p-3 cursor-text whitespace-pre-wrap overflow-auto
            ${colors.text}
            ${!content ? 'opacity-50' : ''}
          `}
        >
          {content || 'Double-click to edit...'}
        </div>
      )}
    </div>
  );
}

export default memo(StickyNote);
