export type FilterShape = 'Bell' | 'Low Cut' | 'High Cut' | 'Low Shelf' | 'High Shelf';
export type StereoPlacement = 'Stereo' | 'Left' | 'Right' | 'Mid' | 'Side';

export type EqNode = {
  id: number;
  x: number; // 0 to 1 (20 Hz - 20 kHz)
  y: number; // 0 to 1 (-15 dB to +15 dB)
  q: number; // 0.1 to 10.0
  shape: FilterShape;
  stereo: StereoPlacement;
  enabled: boolean;
};

export type Preset = {
  id: string;
  name: string;
  isFactory?: boolean;
  decay: number;
  preDelay: number;
  mix: number;
  width: number;
  sync: boolean;
  power: boolean;
  nodes: EqNode[];
};
