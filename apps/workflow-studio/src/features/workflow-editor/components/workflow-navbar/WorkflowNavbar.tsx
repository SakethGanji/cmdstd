import { useState, useRef, useEffect } from 'react';
import { Link, useMatchRoute } from '@tanstack/react-router';
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
import { Switch } from '@/shared/components/ui/switch';
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
import type { WorkflowNodeData } from '../../types/workflow';
import type { Node } from 'reactflow';

export default function WorkflowNavbar() {
  const {
    workflowName,
    workflowTags,
    isActive,
    workflowId,
    nodes,
    edges,
    setWorkflowName,
    addTag,
    removeTag,
    setIsActive,
  } = useWorkflowStore();

  const { saveWorkflow, isSaving } = useSaveWorkflow();
  const { toggleActive, isToggling } = useToggleWorkflowActive();

  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const matchRoute = useMatchRoute();
  const isEditorActive = matchRoute({ to: '/editor' });

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
      className="fixed top-2 right-2 z-30 flex justify-center transition-[left] duration-200 ease-linear"
      style={{ left: isCollapsed ? 'calc(var(--sidebar-width-icon) + 1rem)' : 'calc(var(--sidebar-width) + 1rem)' }}
    >
      <div className="flex h-12 w-full max-w-5xl items-center justify-between rounded-lg border border-border bg-sidebar px-3 shadow-sm">
        {/* Left section - Personal / Workflow name / Tags */}
        <div className="flex items-center gap-2">
          {/* Personal indicator */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <User size={14} />
            <span>Personal</span>
          </div>

          <span className="text-muted-foreground/50">/</span>

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
              className="h-7 w-40 rounded border border-border bg-background px-2 text-sm font-medium text-foreground outline-none focus:border-primary"
            />
          ) : (
            <button
              onClick={() => {
                setEditedName(workflowName);
                setIsEditingName(true);
              }}
              className="rounded px-1.5 py-0.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              {workflowName}
            </button>
          )}

          {/* Tags */}
          <div className="flex items-center gap-1.5 ml-1">
            {workflowTags.map((tag) => (
              <span
                key={tag}
                className="group flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                >
                  <X size={12} />
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
                placeholder="Tag name"
                className="h-6 w-20 rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary"
              />
            ) : (
              <button
                onClick={() => setIsAddingTag(true)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Plus size={12} />
                Add tag
              </button>
            )}
          </div>
        </div>

        {/* Center section - Mode toggle and Navigation tabs */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          {/* Builder / UI Mode Toggle */}
          <ModeToggle />

          {/* Navigation tabs */}
          <div className="flex items-center rounded-lg bg-muted p-1">
            <Link
              to="/editor"
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                isEditorActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Editor
            </Link>
            <button
              className="rounded-md px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Executions
            </button>
            <button
              className="rounded-md px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Evaluations
            </button>
          </div>
        </div>

        {/* Right section - Active toggle, Share, Save, History, More */}
        <div className="flex items-center gap-2">
          {/* Active/Inactive toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {isActive ? 'Active' : 'Inactive'}
            </span>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => {
                if (workflowId) {
                  toggleActive(checked);
                } else {
                  setIsActive(checked);
                }
              }}
              disabled={isToggling}
            />
          </div>

          <div className="h-5 w-px bg-border mx-1" />

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
    <div className="flex items-center rounded-lg bg-muted p-1">
      <button
        onClick={() => setMode('builder')}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors ${
          mode === 'builder'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Workflow size={14} />
        Builder
      </button>
      <button
        onClick={() => setMode('ui')}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors ${
          mode === 'ui'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Play size={14} />
        UI
      </button>
    </div>
  );
}
