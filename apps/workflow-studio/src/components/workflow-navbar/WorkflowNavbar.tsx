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
} from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useSidebar } from '../ui/sidebar';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export default function WorkflowNavbar() {
  const {
    workflowName,
    workflowTags,
    isActive,
    setWorkflowName,
    addTag,
    removeTag,
    setIsActive,
  } = useWorkflowStore();

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

        {/* Center section - Navigation tabs */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
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
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="h-5 w-px bg-border mx-1" />

          {/* Share button */}
          <Button variant="outline" size="sm" className="gap-1.5">
            <Share2 size={14} />
            Share
          </Button>

          {/* Save button */}
          <Button size="sm" className="gap-1.5">
            <Save size={14} />
            Save
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
              <DropdownMenuItem>
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
