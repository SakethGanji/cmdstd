import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ReactFlowProvider } from 'reactflow';
import { MoreHorizontal, Play, Calendar, GitBranch, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardFooter, CardHeader } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

import { WorkflowThumbnail } from './WorkflowThumbnail';
import type { WorkflowWithDefinition } from '../hooks/useWorkflows';
import { workflowsApi } from '@/shared/lib/api';

interface WorkflowCardProps {
  workflow: WorkflowWithDefinition;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function WorkflowCard({ workflow }: WorkflowCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleOpen = () => {
    navigate({ to: '/editor', search: { workflowId: workflow.id } });
  };

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) return;

    setIsRunning(true);
    try {
      const result = await workflowsApi.run(workflow.id);
      if (result.status === 'success') {
        toast.success('Workflow executed', {
          description: `Execution ID: ${result.executionId}`,
        });
      } else {
        toast.error('Workflow failed', {
          description: result.errors?.[0]?.error || 'Unknown error',
        });
      }
    } catch (error) {
      toast.error('Failed to run workflow', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDuplicating) return;

    setIsDuplicating(true);
    try {
      // Create a copy with a new name
      const duplicateWorkflow = {
        name: `${workflow.name} (copy)`,
        nodes: workflow.definition.nodes.map((node) => ({
          name: node.name,
          type: node.type,
          parameters: node.parameters,
          position: node.position,
        })),
        connections: workflow.definition.connections.map((conn) => ({
          source_node: conn.sourceNode,
          source_output: conn.sourceOutput,
          target_node: conn.targetNode,
          target_input: conn.targetInput,
        })),
      };
      await workflowsApi.create(duplicateWorkflow);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow duplicated', {
        description: `"${duplicateWorkflow.name}" has been created.`,
      });
    } catch (error) {
      toast.error('Failed to duplicate workflow', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await workflowsApi.delete(workflow.id);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow deleted', {
        description: `"${workflow.name}" has been deleted.`,
      });
    } catch (error) {
      toast.error('Failed to delete workflow', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card
      className="group cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
      onClick={handleOpen}
    >
      <CardHeader className="p-3 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{workflow.name}</h3>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant={workflow.active ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
              {workflow.active ? 'Active' : 'Inactive'}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={handleOpen}>Open in Editor</DropdownMenuItem>
                <DropdownMenuItem onClick={handleRun} disabled={isRunning}>
                  {isRunning ? 'Running...' : 'Run Workflow'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDuplicate} disabled={isDuplicating}>
                  {isDuplicating ? 'Duplicating...' : 'Duplicate'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3">
        <ReactFlowProvider>
          <WorkflowThumbnail
            definition={workflow.definition}
            className="h-32 w-full rounded-md overflow-hidden border"
          />
        </ReactFlowProvider>
      </CardContent>

      <CardFooter className="p-3 pt-0">
        <div className="flex items-center justify-between w-full text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {workflow.nodeCount} nodes
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(workflow.updatedAt)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
