import type { NodeDefinition } from '../../types/workflow';
import { getNodeGroupFromType, getNodeStyles, type NodeGroup } from '../../lib/nodeStyles';
import { getIconForNode } from '../../lib/nodeIcons';

interface NodeItemProps {
  node: NodeDefinition & { group?: NodeGroup };
  onClick: () => void;
}

export default function NodeItem({ node, onClick }: NodeItemProps) {
  const IconComponent = getIconForNode(node.icon, node.type);

  // Get group-based styling to match canvas nodes
  const nodeGroup = getNodeGroupFromType(node.type, node.group ? [node.group] : (node.category ? [node.category] : undefined));
  const styles = getNodeStyles(nodeGroup);

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-all hover:border-border hover:bg-accent/50 hover:shadow-sm"
    >
      <div
        className={`
          flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
          group-hover:scale-105 transition-transform
          ${nodeGroup === 'ai' ? 'node-ai-shimmer' : ''}
        `}
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
      {/* Accent indicator */}
      <div
        className="h-8 w-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: styles.accentColor }}
      />
    </button>
  );
}
