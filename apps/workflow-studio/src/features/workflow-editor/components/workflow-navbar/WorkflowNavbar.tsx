import { useState, useRef, useEffect } from 'react';
import {
  User,
  Plus,
  X,
  Share2,
  Save,
  History,
  MoreHorizontal,
  Copy,
  Download,
  Upload,
  Trash2,
  Loader2,
  Workflow,
  Play,
} from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useUIModeStore } from '../../stores/uiModeStore';
import { useSidebar } from '@/shared/components/ui/sidebar';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useSaveWorkflow, useToggleWorkflowActive } from '../../hooks/useWorkflowApi';
import { toBackendWorkflow } from '../../lib/workflowTransform';
import { Switch } from '@/shared/components/ui/switch';
import type { WorkflowNodeData } from '../../types/workflow';
import type { Node } from 'reactflow';

export default function WorkflowNavbar() {
  const {
    workflowName,
    workflowTags,
    workflowId,
    nodes,
    edges,
    isActive,
    setWorkflowName,
    addTag,
    removeTag,
  } = useWorkflowStore();

  const { saveWorkflow, isSaving } = useSaveWorkflow();
  const { toggleActive, isToggling } = useToggleWorkflowActive();

  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(workflowName);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (isAddingTag && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [isAddingTag]);

  const handleNameSubmit = () => {
    if (editedName.trim()) {
      setWorkflowName(editedName.trim());
    } else {
      setEditedName(workflowName);
    }
    setIsEditingName(false);
  };

  const handleTagSubmit = () => {
    if (newTag.trim() && !workflowTags.includes(newTag.trim())) {
      addTag(newTag.trim());
    }
    setNewTag('');
    setIsAddingTag(false);
  };

  return (
    <div
      className="fixed top-4 right-4 z-30 flex justify-center transition-[left] duration-200 ease-linear"
      style={{ left: isCollapsed ? 'calc(var(--sidebar-width-icon) + 1.5rem)' : 'calc(var(--sidebar-width) + 1.5rem)' }}
    >
      <div className="glass-panel flex h-14 w-full max-w-5xl items-center justify-between px-4">
        {/* Left section - Personal / Workflow name / Tags */}
        <div className="flex items-center gap-3">
          {/* Personal indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <User size={14} className="text-primary" />
            </div>
            <span className="font-medium">Personal</span>
          </div>

          <span className="text-muted-foreground/30">/</span>

          {/* Workflow name (editable) */}
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') {
                  setEditedName(workflowName);
                  setIsEditingName(false);
                }
              }}
              className="h-8 w-44 rounded-xl border border-[var(--input-border)] bg-[var(--input)] px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          ) : (
            <button
              onClick={() => {
                setEditedName(workflowName);
                setIsEditingName(true);
              }}
              className="rounded-xl px-2 py-1 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
            >
              {workflowName}
            </button>
          )}

          {/* Tags */}
          <div className="flex items-center gap-2 ml-2">
            {workflowTags.map((tag) => (
              <span
                key={tag}
                className="group glass-badge flex items-center gap-1.5"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                >
                  <X size={10} />
                </button>
              </span>
            ))}

            {/* Add tag */}
            {isAddingTag ? (
              <input
                ref={tagInputRef}
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onBlur={handleTagSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTagSubmit();
                  if (e.key === 'Escape') {
                    setNewTag('');
                    setIsAddingTag(false);
                  }
                }}
                placeholder="Tag"
                className="h-7 w-20 rounded-lg border border-[var(--input-border)] bg-[var(--input)] px-2 text-xs outline-none focus:border-primary"
              />
            ) : (
              <button
                onClick={() => setIsAddingTag(true)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Plus size={12} />
                Add tag
              </button>
            )}
          </div>
        </div>

        {/* Center section - Mode toggle */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <ModeToggle />
        </div>

        {/* Right section - Active toggle, Share, Save, History, More */}
        <div className="flex items-center gap-2">

          {/* Active toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-[var(--success)]' : 'text-muted-foreground'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => toggleActive(checked)}
              disabled={isToggling || !workflowId}
              className="data-[state=checked]:bg-[var(--success)]"
            />
          </div>

          {/* Share button */}
          <Button variant="outline" size="icon-sm">
            <Share2 size={16} />
          </Button>

          {/* Save button */}
          <Button size="icon-sm" onClick={() => saveWorkflow()} disabled={isSaving}>
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          </Button>

          {/* History button */}
          <Button variant="ghost" size="icon-sm">
            <History size={16} />
          </Button>

          {/* More options dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Copy size={14} className="mr-2" />
                Duplicate workflow
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const workflow = toBackendWorkflow(
                  nodes as Node<WorkflowNodeData>[],
                  edges,
                  workflowName,
                  workflowId
                );
                const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download size={14} className="mr-2" />
                Export workflow
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Upload size={14} className="mr-2" />
                Import workflow
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                <Trash2 size={14} className="mr-2" />
                Delete workflow
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function ModeToggle() {
  const mode = useUIModeStore((s) => s.mode);
  const setMode = useUIModeStore((s) => s.setMode);

  return (
    <div className="glass-toggle-group flex items-center">
      <button
        onClick={() => setMode('builder')}
        className={`glass-toggle-item flex items-center gap-2 ${mode === 'builder'
          ? 'active'
          : 'text-muted-foreground hover:text-foreground'
          }`}
      >
        <Workflow size={14} />
        Builder
      </button>
      <button
        onClick={() => setMode('ui')}
        className={`glass-toggle-item flex items-center gap-2 ${mode === 'ui'
          ? 'active'
          : 'text-muted-foreground hover:text-foreground'
          }`}
      >
        <Play size={14} />
        UI
      </button>
    </div>
  );
}
