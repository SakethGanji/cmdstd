import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { useNDVStore } from '../../../stores/ndvStore';
import type { WorkflowNodeData, SubnodeType } from '../../../types/workflow';
import { getIconForNode } from '../../../lib/nodeIcons';
import { cn } from '@/shared/lib/utils';

// Subnode styling config using CSS variables
interface SubnodeStyleConfig {
  accentColor: string;
  bgColor: string;
  borderColor: string;
  iconBgColor: string;
}

function getSubnodeStyles(type: SubnodeType): SubnodeStyleConfig {
  const styles: Record<SubnodeType, SubnodeStyleConfig> = {
    model: {
      accentColor: 'var(--subnode-model)',
      bgColor: 'var(--subnode-model-light)',
      borderColor: 'var(--subnode-model-border)',
      iconBgColor: 'var(--subnode-model-icon-bg)',
    },
    memory: {
      accentColor: 'var(--subnode-memory)',
      bgColor: 'var(--subnode-memory-light)',
      borderColor: 'var(--subnode-memory-border)',
      iconBgColor: 'var(--subnode-memory-icon-bg)',
    },
    tool: {
      accentColor: 'var(--subnode-tool)',
      bgColor: 'var(--subnode-tool-light)',
      borderColor: 'var(--subnode-tool-border)',
      iconBgColor: 'var(--subnode-tool-icon-bg)',
    },
  };
  return styles[type];
}

// Type display names
const typeLabels: Record<SubnodeType, string> = {
  model: 'Model',
  memory: 'Memory',
  tool: 'Tool',
};

function SubnodeNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const openNDV = useNDVStore((s) => s.openNDV);

  const subnodeType = data.subnodeType || 'tool';
  const styles = useMemo(() => getSubnodeStyles(subnodeType), [subnodeType]);

  // Get icon using shared utility
  const IconComponent = getIconForNode(data.icon, data.type);

  const handleDoubleClick = () => {
    openNDV(id);
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Type label above node */}
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span
          className="text-[10px] font-medium"
          style={{ color: styles.accentColor }}
        >
          {typeLabels[subnodeType]}
        </span>
      </div>

      {/* Circular node with consistent styling */}
      <div
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center',
          'border-2 transition-all duration-200 cursor-grab',
          selected && 'ring-2 ring-offset-2 ring-offset-background',
          data.disabled && 'opacity-50',
        )}
        style={{
          backgroundColor: styles.bgColor,
          borderColor: selected ? styles.accentColor : styles.borderColor,
          boxShadow: selected ? `0 4px 12px color-mix(in srgb, ${styles.accentColor} 40%, transparent)` : '0 1px 3px rgba(0,0,0,0.1)',
          // @ts-expect-error CSS custom property
          '--tw-ring-color': styles.accentColor,
        }}
        onDoubleClick={handleDoubleClick}
      >
        {/* Top handle - connects to parent node */}
        <Handle
          type="source"
          position={Position.Top}
          id="config"
          className="!w-1.5 !h-1.5 !border-2"
          style={{
            backgroundColor: 'var(--node-handle)',
            borderColor: 'var(--node-handle)',
          }}
        />

        {/* Icon with background */}
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{
            backgroundColor: styles.iconBgColor,
            color: styles.accentColor,
          }}
        >
          <IconComponent size={16} />
        </div>
      </div>

      {/* Label below node */}
      <div className="mt-2 max-w-[90px] text-center">
        <span className="text-[11px] text-foreground/90 font-medium leading-tight block">
          {data.label}
        </span>
      </div>
    </div>
  );
}

export default memo(SubnodeNode);
