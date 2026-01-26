import { createRoute, useNavigate } from '@tanstack/react-router';
import { Plus, Search, Loader2, FolderOpen } from 'lucide-react';
import { useState } from 'react';

import { rootRoute } from './__root';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { WorkflowCard } from '@/features/workflows/components/WorkflowCard';
import { useWorkflows } from '@/features/workflows/hooks/useWorkflows';
import { useWorkflowStore } from '@/features/workflow-editor/stores/workflowStore';

export const workflowsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'workflows',
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const { data: workflows, isLoading, error } = useWorkflows();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);

  const handleNewWorkflow = () => {
    resetWorkflow();
    navigate({ to: '/editor' });
  };

  const filteredWorkflows = workflows?.filter((workflow) =>
    workflow.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <header className="glass-panel m-6 mb-0 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Workflows</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage and run your automation workflows
            </p>
          </div>
          <Button onClick={handleNewWorkflow} variant="glass" className="gap-2">
            <Plus className="h-4 w-4" />
            New Workflow
          </Button>
        </div>

        {/* Search */}
        <div className="mt-5 max-w-md">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11"
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
              <p className="text-sm font-medium text-muted-foreground">Loading workflows...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="glass-card p-8 text-center">
              <p className="text-sm font-semibold text-destructive">Failed to load workflows</p>
              <p className="text-xs text-muted-foreground mt-2">{String(error)}</p>
            </div>
          </div>
        ) : filteredWorkflows?.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="glass-card p-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">
                {searchQuery ? 'No workflows match your search' : 'No workflows yet'}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {searchQuery ? 'Try a different search term' : 'Get started by creating your first workflow'}
              </p>
              {!searchQuery && (
                <Button variant="glass" onClick={handleNewWorkflow} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create your first workflow
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredWorkflows?.map((workflow) => (
              <WorkflowCard key={workflow.id} workflow={workflow} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
