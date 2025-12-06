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
  type LucideIcon,
} from 'lucide-react';
import type { NodeDefinition } from '../../types/workflow';

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
};

interface NodeItemProps {
  node: NodeDefinition;
  onClick: () => void;
}

export default function NodeItem({ node, onClick }: NodeItemProps) {
  const IconComponent = iconMap[node.icon] || Code;
  const isTrigger = node.category === 'trigger';

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-left transition-all hover:border-neutral-200 hover:bg-neutral-50 hover:shadow-sm"
    >
      <div
        className={`
          flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
          ${isTrigger ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}
          group-hover:scale-105 transition-transform
        `}
      >
        <IconComponent size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-neutral-800">{node.displayName}</p>
        <p className="truncate text-sm text-neutral-500">{node.description}</p>
      </div>
    </button>
  );
}
