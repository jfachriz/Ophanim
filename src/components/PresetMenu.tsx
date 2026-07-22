import React, { useState } from 'react';
import { Preset, EqNode } from '../types/plugin';

export const FACTORY_PRESETS: Preset[] = [
  {
    id: 'factory-1',
    name: 'Vocal Hall',
    isFactory: true,
    decay: 65,
    preDelay: 25,
    mix: 45,
    width: 85,
    sync: false,
    power: true,
    nodes: [
      { id: 1, x: 0.15, y: 0.65, q: 0.7, shape: 'Low Cut', stereo: 'Stereo', enabled: true },
      { id: 2, x: 0.45, y: 0.42, q: 1.2, shape: 'Bell', stereo: 'Stereo', enabled: true },
      { id: 3, x: 0.85, y: 0.38, q: 1.0, shape: 'High Cut', stereo: 'Stereo', enabled: true }
    ]
  },
  {
    id: 'factory-2',
    name: 'Cathedral Space',
    isFactory: true,
    decay: 90,
    preDelay: 60,
    mix: 60,
    width: 100,
    sync: false,
    power: true,
    nodes: [
      { id: 1, x: 0.2, y: 0.6, q: 0.8, shape: 'Low Cut', stereo: 'Stereo', enabled: true },
      { id: 2, x: 0.75, y: 0.35, q: 1.5, shape: 'High Shelf', stereo: 'Mid', enabled: true }
    ]
  },
  {
    id: 'factory-3',
    name: 'Bright Plate',
    isFactory: true,
    decay: 45,
    preDelay: 10,
    mix: 35,
    width: 75,
    sync: false,
    power: true,
    nodes: [
      { id: 1, x: 0.3, y: 0.5, q: 1.0, shape: 'Bell', stereo: 'Stereo', enabled: true },
      { id: 2, x: 0.7, y: 0.3, q: 1.4, shape: 'High Shelf', stereo: 'Side', enabled: true }
    ]
  },
  {
    id: 'factory-4',
    name: 'Drum Chamber',
    isFactory: true,
    decay: 30,
    preDelay: 5,
    mix: 40,
    width: 60,
    sync: false,
    power: true,
    nodes: [
      { id: 1, x: 0.25, y: 0.55, q: 1.1, shape: 'Low Shelf', stereo: 'Stereo', enabled: true },
      { id: 2, x: 0.8, y: 0.45, q: 1.8, shape: 'High Cut', stereo: 'Stereo', enabled: true }
    ]
  },
  {
    id: 'factory-5',
    name: 'Ambient Atmosphere',
    isFactory: true,
    decay: 95,
    preDelay: 120,
    mix: 70,
    width: 100,
    sync: false,
    power: true,
    nodes: [
      { id: 1, x: 0.1, y: 0.7, q: 0.5, shape: 'Low Cut', stereo: 'Stereo', enabled: true },
      { id: 2, x: 0.6, y: 0.25, q: 2.0, shape: 'Bell', stereo: 'Side', enabled: true }
    ]
  },
  {
    id: 'factory-6',
    name: 'Dark Cave',
    isFactory: true,
    decay: 75,
    preDelay: 40,
    mix: 50,
    width: 50,
    sync: false,
    power: true,
    nodes: [
      { id: 1, x: 0.5, y: 0.55, q: 1.0, shape: 'Bell', stereo: 'Stereo', enabled: true },
      { id: 2, x: 0.75, y: 0.75, q: 1.2, shape: 'High Cut', stereo: 'Stereo', enabled: true }
    ]
  },
  {
    id: 'factory-7',
    name: 'Celestial Shimmer',
    isFactory: true,
    decay: 85,
    preDelay: 30,
    mix: 55,
    width: 90,
    sync: false,
    power: true,
    nodes: [
      { id: 1, x: 0.3, y: 0.5, q: 1.0, shape: 'Bell', stereo: 'Stereo', enabled: true },
      { id: 2, x: 0.82, y: 0.2, q: 2.5, shape: 'High Shelf', stereo: 'Side', enabled: true }
    ]
  },
  {
    id: 'factory-8',
    name: 'Tight Vocal Room',
    isFactory: true,
    decay: 25,
    preDelay: 15,
    mix: 30,
    width: 70,
    sync: false,
    power: true,
    nodes: [
      { id: 1, x: 0.2, y: 0.6, q: 1.2, shape: 'Low Cut', stereo: 'Stereo', enabled: true },
      { id: 2, x: 0.5, y: 0.48, q: 1.0, shape: 'Bell', stereo: 'Stereo', enabled: true }
    ]
  },
  {
    id: 'factory-9',
    name: 'Gated Snare Space',
    isFactory: true,
    decay: 35,
    preDelay: 0,
    mix: 65,
    width: 80,
    sync: false,
    power: true,
    nodes: [
      { id: 1, x: 0.35, y: 0.4, q: 1.5, shape: 'Bell', stereo: 'Stereo', enabled: true },
      { id: 2, x: 0.7, y: 0.6, q: 2.0, shape: 'High Cut', stereo: 'Stereo', enabled: true }
    ]
  },
  {
    id: 'factory-10',
    name: 'Ethereal Strings',
    isFactory: true,
    decay: 88,
    preDelay: 80,
    mix: 50,
    width: 95,
    sync: false,
    power: true,
    nodes: [
      { id: 1, x: 0.18, y: 0.65, q: 0.9, shape: 'Low Cut', stereo: 'Stereo', enabled: true },
      { id: 2, x: 0.65, y: 0.3, q: 1.3, shape: 'High Shelf', stereo: 'Side', enabled: true }
    ]
  }
];

type PresetMenuProps = {
  currentPresetName: string;
  onSelectPreset: (preset: Preset) => void;
  onSaveCurrentPreset: (name: string) => void;
  onDeletePreset: (presetId: string) => void;
  onRenamePreset: (presetId: string, newName: string) => void;
  userPresets: Preset[];
};

export const PresetMenu: React.FC<PresetMenuProps> = ({
  currentPresetName,
  onSelectPreset,
  onSaveCurrentPreset,
  onDeletePreset,
  onRenamePreset,
  userPresets
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPresetName.trim()) {
      onSaveCurrentPreset(newPresetName.trim());
      setNewPresetName('');
      setIsSaving(false);
    }
  };

  const handleRenameSubmit = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (renameText.trim()) {
      onRenamePreset(id, renameText.trim());
      setRenamingId(null);
      setRenameText('');
    }
  };

  return (
    <div className="relative z-30 inline-block">
      {/* 2.1 Upper left side preset button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181a20]/90 hover:bg-[#22252d] border border-white/10 text-gray-200 text-[11px] font-bold tracking-wider shadow-lg transition-all cursor-pointer backdrop-blur-md"
      >
        <span className="text-[#E09F3E]">⚡</span>
        <span className="truncate max-w-[120px]">{currentPresetName || 'PRESETS'}</span>
        <span className="text-[10px] text-gray-400">▼</span>
      </button>

      {/* Preset Dropdown Overlay */}
      {isOpen && (
        <div className="absolute top-10 left-0 w-64 rounded-xl bg-[#14161c] border border-white/15 shadow-2xl p-2 text-xs text-gray-200 backdrop-blur-xl">
          {/* Header Actions */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10 px-2 pt-1 mb-1">
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Preset Library</span>
            <button
              onClick={() => setIsSaving(true)}
              className="text-[10px] px-2 py-0.5 rounded bg-[#E09F3E]/20 hover:bg-[#E09F3E]/35 text-[#F2C94C] font-semibold cursor-pointer border border-[#E09F3E]/40"
            >
              + Save Preset
            </button>
          </div>

          {/* Save Input Modal/Row */}
          {isSaving && (
            <form onSubmit={handleSave} className="p-2 my-1 bg-[#1a1d24] rounded-lg border border-[#E09F3E]/40">
              <input
                type="text"
                placeholder="Enter preset name..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                autoFocus
                className="w-full bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#E09F3E] mb-2"
              />
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setIsSaving(false)}
                  className="px-2 py-1 text-[10px] text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-1 text-[10px] bg-[#E09F3E] text-black font-bold rounded"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {/* Presets Scroll List */}
          <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
            {/* User Presets */}
            {userPresets.length > 0 && (
              <div className="mb-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#E09F3E]/80 px-2 py-1">User Presets</div>
                {userPresets.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/10 group cursor-pointer"
                  >
                    {renamingId === p.id ? (
                      <form onSubmit={(e) => handleRenameSubmit(p.id, e)} className="flex items-center gap-1 w-full">
                        <input
                          type="text"
                          value={renameText}
                          onChange={(e) => setRenameText(e.target.value)}
                          className="bg-black text-white px-1 py-0.5 rounded text-xs w-full"
                          autoFocus
                        />
                        <button type="submit" className="text-[10px] text-[#E09F3E] font-bold px-1">OK</button>
                      </form>
                    ) : (
                      <>
                        <span
                          onClick={() => { onSelectPreset(p); setIsOpen(false); }}
                          className={`flex-1 truncate ${currentPresetName === p.name ? 'text-[#F2C94C] font-bold' : ''}`}
                        >
                          {p.name}
                        </span>
                        <div className="hidden group-hover:flex items-center gap-1">
                          <button
                            onClick={() => { setRenamingId(p.id); setRenameText(p.name); }}
                            className="text-[10px] text-gray-400 hover:text-[#E09F3E] px-1"
                            title="Rename"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => onDeletePreset(p.id)}
                            className="text-[10px] text-gray-400 hover:text-red-400 px-1"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Factory Presets */}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500 px-2 py-1">Factory Presets</div>
              {FACTORY_PRESETS.map((p) => (
                <div
                  key={p.id}
                  onClick={() => { onSelectPreset(p); setIsOpen(false); }}
                  className={`px-2 py-1.5 rounded hover:bg-white/10 cursor-pointer flex items-center justify-between transition-colors ${
                    currentPresetName === p.name ? 'bg-[#E09F3E]/15 text-[#F2C94C] font-bold border-l-2 border-[#E09F3E]' : 'text-gray-300'
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  {currentPresetName === p.name && <span className="text-[10px] text-[#E09F3E]">✓</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
