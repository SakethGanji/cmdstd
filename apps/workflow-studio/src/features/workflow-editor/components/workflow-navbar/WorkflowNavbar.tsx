import { useState, useRef, useEffect } from 'react';
import {
  Save,
  MoreHorizontal,
  Copy,
  Download,
  Upload,
  Trash2,
  Loader2,
  Play,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Plus,
  Square,
  PanelRight,
} from 'lucide-react';
import { useReactFlow } from 'reactflow';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useUIModeStore } from '../../stores/uiModeStore';
import { useNodeCreatorStore } from '../../stores/nodeCreatorStore';
import { useExecutionStream } from '../../hooks/useExecutionStream';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import CodeEditor from '@/shared/components/ui/code-editor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useSaveWorkflow, useToggleWorkflowActive, useImportWorkflow } from '../../hooks/useWorkflowApi';
import { toBackendWorkflow } from '../../lib/workflowTransform';
import { Switch } from '@/shared/components/ui/switch';
import type { WorkflowNodeData } from '../../types/workflow';
import type { Node } from 'reactflow';

export default function WorkflowNavbar() {
  const {
    workflowName,
    workflowId,
    nodes,
    edges,
    isActive,
    setWorkflowName,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useWorkflowStore();

  const { saveWorkflow, isSaving } = useSaveWorkflow();
  const { toggleActive, isToggling } = useToggleWorkflowActive();
  const { importWorkflow } = useImportWorkflow();
  const { executeWorkflow, isExecuting, cancelExecution } = useExecutionStream();

  const isPreviewOpen = useUIModeStore((s) => s.isPreviewOpen);
  const togglePreview = useUIModeStore((s) => s.togglePreview);
  const openPanel = useNodeCreatorStore((s) => s.openPanel);

  const { zoomIn, zoomOut } = useReactFlow();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(workflowName);
  const [isRunOpen, setIsRunOpen] = useState(false);
  const [testInput, setTestInput] = useState(`{
  "message": "Hello world",
  "count": 42
}`);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRunWithPayload = () => {
    try {
      const parsed = JSON.parse(testInput);
      setIsRunOpen(false);
      executeWorkflow(parsed);
    } catch {
      // If JSON is invalid, just run without payload
      setIsRunOpen(false);
      executeWorkflow({});
    }
  };

  const handleRunWithoutPayload = () => {
    setIsRunOpen(false);
    executeWorkflow({});
  };

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSubmit = () => {
    if (editedName.trim()) {
      setWorkflowName(editedName.trim());
    } else {
      setEditedName(workflowName);
    }
    setIsEditingName(false);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      // Use the hook which POSTs to backend and loads the enriched result
      importWorkflow(content);
    };
    reader.readAsText(file);

    // Reset input so same file can be imported again
    event.target.value = '';
  };

  const btnClass = "h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const dividerClass = "w-px h-5 bg-border";

  return (
    <>
      {/* Unified floating toolbar */}
      <div className="absolute top-4 right-4 z-30 flex items-center h-9 bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {/* Workflow name */}
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
            className="h-full w-32 px-3 text-sm font-medium text-foreground bg-transparent outline-none border-r border-border"
          />
        ) : (
          <button
            onClick={() => {
              setEditedName(workflowName);
              setIsEditingName(true);
            }}
            className="h-full px-3 text-sm font-medium text-foreground hover:bg-accent transition-colors truncate max-w-36 border-r border-border"
            title="Click to rename"
          >
            {workflowName}
          </button>
        )}

        {/* Undo/Redo */}
        <button onClick={() => undo()} disabled={!canUndo()} className={btnClass} title="Undo">
          <Undo2 size={14} />
        </button>
        <button onClick={() => redo()} disabled={!canRedo()} className={btnClass} title="Redo">
          <Redo2 size={14} />
        </button>

        <div className={dividerClass} />

        {/* Zoom */}
        <button onClick={() => zoomOut()} className={btnClass} title="Zoom out">
          <ZoomOut size={14} />
        </button>
        <button onClick={() => zoomIn()} className={btnClass} title="Zoom in">
          <ZoomIn size={14} />
        </button>

        <div className={dividerClass} />

        {/* UI Preview toggle */}
        <button
          onClick={togglePreview}
          className={btnClass + ` px-2 gap-1 ${isPreviewOpen ? '!text-primary' : ''}`}
          title="Toggle UI preview"
        >
          <PanelRight size={14} />
        </button>

        {/* Run/Stop */}
        {isExecuting ? (
          <button
            onClick={cancelExecution}
            className={btnClass + ' !text-destructive'}
            title="Stop"
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <Popover open={isRunOpen} onOpenChange={setIsRunOpen}>
            <PopoverTrigger asChild>
              <button
                className={btnClass + ' !text-emerald-600'}
                title="Run workflow"
              >
                <Play size={16} fill="currentColor" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
              {/* Quick run */}
              <button
                onClick={handleRunWithoutPayload}
                className="w-full px-3 py-2.5 text-sm text-left hover:bg-accent flex items-center gap-2 border-b border-border"
              >
                <Play size={14} className="text-emerald-600" fill="currentColor" />
                Run without payload
              </button>
              {/* With payload */}
              <div className="p-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">Or run with payload:</div>
                <div className="rounded-lg border border-border overflow-hidden mb-3">
                  <CodeEditor
                    value={testInput}
                    onChange={setTestInput}
                    language="json"
                    height="100px"
                  />
                </div>
                <button
                  onClick={handleRunWithPayload}
                  className="w-full h-8 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 flex items-center justify-center gap-1.5"
                >
                  <Play size={12} fill="currentColor" />
                  Run with Payload
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        <div className={dividerClass} />

        {/* Add node */}
        <button
          onClick={() => openPanel('regular')}
          className="h-full px-2 text-primary hover:bg-accent transition-colors"
          title="Add node"
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>

        <div className={dividerClass} />

        {/* Active toggle */}
        <div className="h-full px-2 flex items-center">
          <Switch
            checked={isActive}
            onCheckedChange={(checked) => toggleActive(checked)}
            disabled={isToggling || !workflowId}
            className="data-[state=checked]:bg-[var(--success)]"
          />
        </div>

        {/* Save */}
        <button
          onClick={() => saveWorkflow()}
          disabled={isSaving}
          className={btnClass}
          title="Save"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        </button>

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={btnClass}>
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Copy size={14} className="mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const backendWorkflow = toBackendWorkflow(
                nodes as Node<WorkflowNodeData>[],
                edges,
                workflowName,
                workflowId
              );
              const exportData = {
                name: workflowName,
                description: '',
                active: isActive,
                nodes: backendWorkflow.nodes,
                connections: backendWorkflow.connections,
              };
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}>
              <Download size={14} className="mr-2" />
              Export
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} className="mr-2" />
              Import
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <Trash2 size={14} className="mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />
    </>
  );
}
