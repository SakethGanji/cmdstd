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
    <div className="h-full w-full flex flex-col bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Workflows</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage and run your automation workflows
            </p>
          </div>
          <Button onClick={handleNewWorkflow}>
            <Plus className="h-4 w-4 mr-2" />
            New Workflow
          </Button>
        </div>

        {/* Search */}
        <div className="mt-4 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading workflows...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-sm text-destructive">Failed to load workflows</p>
              <p className="text-xs text-muted-foreground mt-1">{String(error)}</p>
            </div>
          </div>
        ) : filteredWorkflows?.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No workflows match your search' : 'No workflows yet'}
              </p>
              {!searchQuery && (
                <Button variant="outline" className="mt-3" onClick={handleNewWorkflow}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first workflow
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredWorkflows?.map((workflow) => (
              <WorkflowCard key={workflow.id} workflow={workflow} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
