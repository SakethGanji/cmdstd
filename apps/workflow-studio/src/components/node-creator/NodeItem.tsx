import {
  MousePointer,
  Clock,
  Webhook,
  Code,
  Filter,
  GitBranch,
  Route,
  GitMerge,
  Layers,
  Globe,
  Pen,
  Calendar,
  MessageSquare,
  Bot,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import type { NodeDefinition } from '../../types/workflow';
import { getNodeGroupFromType, getNodeStyles } from '../../lib/nodeStyles';

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  'mouse-pointer': MousePointer,
  clock: Clock,
  webhook: Webhook,
  code: Code,
  filter: Filter,
  'git-branch': GitBranch,
  route: Route,
  'git-merge': GitMerge,
  layers: Layers,
  globe: Globe,
  pen: Pen,
  calendar: Calendar,
  'message-square': MessageSquare,
  bot: Bot,
  'alert-triangle': AlertTriangle,
};

interface NodeItemProps {
  node: NodeDefinition;
  onClick: () => void;
}

export default function NodeItem({ node, onClick }: NodeItemProps) {
  const IconComponent = iconMap[node.icon] || Code;

  // Get group-based styling to match canvas nodes
  const nodeGroup = getNodeGroupFromType(node.type, node.category ? [node.category] : undefined);
  const styles = getNodeStyles(nodeGroup);

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-left transition-all hover:border-border hover:bg-accent hover:shadow-sm"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg group-hover:scale-105 transition-transform"
        style={{
          backgroundColor: styles.iconBgColor,
          color: styles.accentColor,
        }}
      >
        <IconComponent size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{node.displayName}</p>
        <p className="truncate text-sm text-muted-foreground">{node.description}</p>
      </div>
    </button>
  );
}
