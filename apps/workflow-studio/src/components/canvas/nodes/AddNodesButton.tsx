import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Plus } from 'lucide-react';
import { useNodeCreatorStore } from '../../../stores/nodeCreatorStore';

interface AddNodesButtonData {
  label: string;
}

function AddNodesButton({ data }: NodeProps<AddNodesButtonData>) {
  const openPanel = useNodeCreatorStore((s) => s.openPanel);

  return (
    <div
      className="nodrag nopan nowheel flex flex-col items-center justify-center"
      style={{ pointerEvents: 'all' }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          console.log('AddNodesButton clicked, opening panel');
          openPanel('trigger');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            openPanel('trigger');
          }
        }}
        className="group flex h-[100px] w-[100px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border bg-card transition-all hover:border-primary hover:bg-primary/10 active:scale-95"
        style={{ pointerEvents: 'all' }}
      >
        <Plus
          size={40}
          className="text-muted-foreground transition-colors group-hover:text-primary"
          style={{ pointerEvents: 'none' }}
        />
      </div>
      <p className="mt-2 text-sm font-medium text-muted-foreground" style={{ pointerEvents: 'none' }}>
        {data.label || 'Add first step...'}
      </p>
    </div>
  );
}

export default memo(AddNodesButton);
