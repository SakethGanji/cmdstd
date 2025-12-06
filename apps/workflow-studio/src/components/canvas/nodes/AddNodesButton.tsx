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
        className="group flex h-[100px] w-[100px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-white transition-all hover:border-blue-500 hover:bg-blue-50 active:scale-95"
        style={{ pointerEvents: 'all' }}
      >
        <Plus
          size={40}
          className="text-neutral-400 transition-colors group-hover:text-blue-500"
          style={{ pointerEvents: 'none' }}
        />
      </div>
      <p className="mt-2 text-sm font-medium text-neutral-600" style={{ pointerEvents: 'none' }}>
        {data.label || 'Add first step...'}
      </p>
    </div>
  );
}

export default memo(AddNodesButton);
