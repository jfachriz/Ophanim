import React, { useState } from 'react';
import { EqNode, FilterShape, StereoPlacement } from '../types/plugin';

type ContextMenuProps = {
  x: number;
  y: number;
  node: EqNode | null;
  onClose: () => void;
  onToggleEnable: (nodeId: number) => void;
  onInvertGain: (nodeId: number) => void;
  onChangeShape: (nodeId: number, shape: FilterShape) => void;
  onChangeStereo: (nodeId: number, stereo: StereoPlacement) => void;
  onDeleteNode: (nodeId: number) => void;
  onAddNode: (x: number, y: number) => void;
};

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  node,
  onClose,
  onToggleEnable,
  onInvertGain,
  onChangeShape,
  onChangeStereo,
  onDeleteNode,
  onAddNode
}) => {
  const [activeSubmenu, setActiveSubmenu] = useState<'shape' | 'stereo' | null>(null);

  const shapes: FilterShape[] = ['Bell', 'Low Cut', 'High Cut', 'Low Shelf', 'High Shelf'];
  const stereos: StereoPlacement[] = ['Stereo', 'Left', 'Right', 'Mid', 'Side'];

  return (
    <div
      className="fixed z-50 bg-[#1e2026] text-gray-200 border border-white/20 rounded-lg shadow-2xl py-1 text-xs w-44 backdrop-blur-xl select-none"
      style={{ left: x, top: y }}
      onMouseLeave={() => setActiveSubmenu(null)}
    >
      {node ? (
        <>
          {/* Enable / Disable */}
          <div
            onClick={() => { onToggleEnable(node.id); onClose(); }}
            className="px-3 py-1.5 hover:bg-white/10 cursor-pointer flex items-center justify-between"
          >
            <span>{node.enabled ? 'Disable' : 'Enable'}</span>
          </div>

          {/* Invert Gain */}
          <div
            onClick={() => { onInvertGain(node.id); onClose(); }}
            className="px-3 py-1.5 hover:bg-white/10 cursor-pointer flex items-center justify-between"
          >
            <span>Invert Gain</span>
          </div>

          <div className="h-px bg-white/10 my-1"></div>

          {/* Shape Submenu */}
          <div
            className="relative px-3 py-1.5 hover:bg-white/10 cursor-pointer flex items-center justify-between"
            onMouseEnter={() => setActiveSubmenu('shape')}
          >
            <span>Shape</span>
            <span className="text-[10px] text-gray-400">›</span>

            {activeSubmenu === 'shape' && (
              <div className="absolute left-full top-0 ml-1 bg-[#1e2026] border border-white/20 rounded-lg shadow-2xl py-1 w-32 backdrop-blur-xl">
                {shapes.map((s) => (
                  <div
                    key={s}
                    onClick={(e) => { e.stopPropagation(); onChangeShape(node.id, s); onClose(); }}
                    className={`px-3 py-1 hover:bg-white/10 cursor-pointer flex items-center justify-between ${node.shape === s ? 'text-[#F2C94C] font-bold' : ''}`}
                  >
                    <span>{s}</span>
                    {node.shape === s && <span>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stereo Placement Submenu */}
          <div
            className="relative px-3 py-1.5 hover:bg-white/10 cursor-pointer flex items-center justify-between"
            onMouseEnter={() => setActiveSubmenu('stereo')}
          >
            <span>Stereo Placement</span>
            <span className="text-[10px] text-gray-400">›</span>

            {activeSubmenu === 'stereo' && (
              <div className="absolute left-full top-0 ml-1 bg-[#1e2026] border border-white/20 rounded-lg shadow-2xl py-1 w-32 backdrop-blur-xl">
                {stereos.map((st) => (
                  <div
                    key={st}
                    onClick={(e) => { e.stopPropagation(); onChangeStereo(node.id, st); onClose(); }}
                    className={`px-3 py-1 hover:bg-white/10 cursor-pointer flex items-center justify-between ${node.stereo === st ? 'text-[#F2C94C] font-bold' : ''}`}
                  >
                    <span>{st}</span>
                    {node.stereo === st && <span>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-white/10 my-1"></div>

          {/* Delete */}
          <div
            onClick={() => { onDeleteNode(node.id); onClose(); }}
            className="px-3 py-1.5 hover:bg-red-900/40 text-red-300 cursor-pointer flex items-center justify-between"
          >
            <span>Delete</span>
          </div>
        </>
      ) : (
        <div
          onClick={() => { onAddNode(x, y); onClose(); }}
          className="px-3 py-1.5 hover:bg-white/10 cursor-pointer text-[#F2C94C] font-semibold"
        >
          + Add EQ Node
        </div>
      )}

    </div>
  );
};
