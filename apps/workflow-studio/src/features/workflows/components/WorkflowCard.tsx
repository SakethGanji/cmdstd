import { useNavigate } from '@tanstack/react-router';
import { ReactFlowProvider } from 'reactflow';
import { MoreHorizontal, Play, Calendar, GitBranch } from 'lucide-react';

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

  const handleOpen = () => {
    // TODO: Navigate to editor with workflow loaded
    navigate({ to: '/editor', search: { workflowId: workflow.id } });
  };

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Run workflow
    console.log('Run workflow:', workflow.id);
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
                <DropdownMenuItem onClick={handleRun}>Run Workflow</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Duplicate</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
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
          >
            <Play className="h-3 w-3" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
