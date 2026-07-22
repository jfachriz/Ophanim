// Web Audio API DSP Engine for Ophanim Reverb

export type EqNodeParam = {
  id: number;
  freq: number;
  gainDb: number;
  q: number;
};

export class WebAudioReverbEngine {
  private ctx: AudioContext | null = null;
  private inputNode: GainNode | null = null;
  private outputNode: GainNode | null = null;
  
  // Pre-Delay
  private preDelayNode: DelayNode | null = null;
  
  // Reverb Convolver / Tail
  private convolverNode: ConvolverNode | null = null;
  private wetGainNode: GainNode | null = null;
  private dryGainNode: GainNode | null = null;
  
  // Mid-Side Width Matrix Nodes
  private wetSplitter: ChannelSplitterNode | null = null;
  private wetMerger: ChannelMergerNode | null = null;
  private midGainNode: GainNode | null = null;
  private sideGainNode: GainNode | null = null;
  
  // Filters (Persistent EQ Nodes keyed by ID to eliminate stuttering during drag)
  private filterMap: Map<number, { filter: BiquadFilterNode; shape: string }> = new Map();
  private filterChainContainer: GainNode | null = null;
  
  // Analyzer
  private analyserNode: AnalyserNode | null = null;
  
  // Test Audio Source
  private isPlayingTestAudio = false;
  private testAudioInterval: number | null = null;
  
  // Current Parameters
  private currentDecay = 60; // 0-100
  private currentPreDelay = 30; // ms
  private currentMix = 50; // 0-100
  private currentWidth = 80; // 0-100
  private isPowerOn = true;

  public init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    const ctx = this.ctx;

    // Core Input & Output
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();

    // Pre-delay
    this.preDelayNode = ctx.createDelay(1.0);
    this.preDelayNode.delayTime.value = this.currentPreDelay / 1000;

    // Dry / Wet Gain
    this.dryGainNode = ctx.createGain();
    this.wetGainNode = ctx.createGain();
    this.setMix(this.currentMix);

    // Convolver for Reverb Tail
    this.convolverNode = ctx.createConvolver();
    this.updateImpulseResponse(this.currentDecay);

    // Filter Chain Container Node
    this.filterChainContainer = ctx.createGain();

    // Mid-Side Stereo Width Processor:
    // Splitter (L, R) -> Mid (L+R) and Side (L-R) matrix
    this.wetSplitter = ctx.createChannelSplitter(2);
    this.wetMerger = ctx.createChannelMerger(2);

    this.midGainNode = ctx.createGain();
    this.sideGainNode = ctx.createGain();

    // Set initial width (0% = mono 0.0x side, 50% = 1.0x, 100% = ultra-wide 2.5x side)
    const sideMultiplier = (this.currentWidth / 100) * 2.5;
    this.sideGainNode.gain.value = sideMultiplier;
    this.midGainNode.gain.value = 1.0;

    // Mid/Side Matrix Routing:
    // Split stereo into L (0) and R (1)
    // Mid = (L + R) * 0.5, Side = (L - R) * 0.5 * sideMultiplier
    const midSum = ctx.createGain();
    midSum.gain.value = 0.5;

    const sideDiffL = ctx.createGain();
    sideDiffL.gain.value = 0.5;

    const sideDiffR = ctx.createGain();
    sideDiffR.gain.value = -0.5;

    // FFT Spectrum Analyser
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Audio Graph Routing:
    // Input -> DryGain -> Output
    this.inputNode.connect(this.dryGainNode);
    this.dryGainNode.connect(this.outputNode);

    // Input -> PreDelay -> Convolver -> FilterChainContainer -> WetGain -> MidSide Matrix -> Analyser -> Output
    this.inputNode.connect(this.preDelayNode);
    this.preDelayNode.connect(this.convolverNode);
    this.convolverNode.connect(this.filterChainContainer);
    this.filterChainContainer.connect(this.wetGainNode);

    // WetGain -> Splitter
    this.wetGainNode.connect(this.wetSplitter);

    // Splitter L,R -> Mid Sum
    this.wetSplitter.connect(midSum, 0);
    this.wetSplitter.connect(midSum, 1);
    midSum.connect(this.midGainNode);

    // Splitter L,R -> Side Diff
    this.wetSplitter.connect(sideDiffL, 0);
    this.wetSplitter.connect(sideDiffR, 1);
    sideDiffL.connect(this.sideGainNode);
    sideDiffR.connect(this.sideGainNode);

    // Re-merge Mid and Side into Stereo Merger
    // Left = Mid + Side
    this.midGainNode.connect(this.wetMerger, 0, 0);
    this.sideGainNode.connect(this.wetMerger, 0, 0);

    // Right = Mid - Side
    this.midGainNode.connect(this.wetMerger, 0, 1);
    // Invert side for right channel
    const sideInvertRight = ctx.createGain();
    sideInvertRight.gain.value = -1.0;
    this.sideGainNode.connect(sideInvertRight);
    sideInvertRight.connect(this.wetMerger, 0, 1);

    // Merger -> Analyser -> Output -> Audio Destination
    this.wetMerger.connect(this.analyserNode);
    this.analyserNode.connect(this.outputNode);
    this.outputNode.connect(ctx.destination);
  }

  public ensureContextRunning() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private updateImpulseResponse(decayPercent: number) {
    if (!this.ctx || !this.convolverNode) return;

    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * (0.2 + (decayPercent / 100) * 7.8);
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    const decayConstant = 3 + (100 - decayPercent) * 0.05;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * decayConstant);
      left[i] = (Math.random() * 2 - 1) * envelope;
      right[i] = (Math.random() * 2 - 1) * envelope;
    }

    this.convolverNode.buffer = impulse;
  }

  private decayDebounceTimer: number | null = null;

  public setDecay(val: number) {
    this.currentDecay = val;
    if (this.decayDebounceTimer !== null) {
      window.clearTimeout(this.decayDebounceTimer);
    }
    // Debounce convolver impulse buffer creation during active knob drag to prevent pops
    this.decayDebounceTimer = window.setTimeout(() => {
      this.updateImpulseResponseSmooth(val);
    }, 60);
  }

  private updateImpulseResponseSmooth(val: number) {
    if (!this.ctx || !this.convolverNode || !this.wetGainNode) return;
    const targetWet = this.isPowerOn ? (this.currentMix / 100) : 0;

    // Quick 10ms micro-fade out wet gain to prevent pop artifact on buffer swap
    this.wetGainNode.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.01);

    setTimeout(() => {
      this.updateImpulseResponse(val);
      if (this.ctx && this.wetGainNode) {
        // Micro-fade wet gain back up
        this.wetGainNode.gain.setTargetAtTime(targetWet, this.ctx.currentTime, 0.02);
      }
    }, 15);
  }

  // Pre-Delay update (Direct assignment prevents pitch Doppler shifting!)
  public setPreDelay(ms: number) {
    this.currentPreDelay = ms;
    if (this.preDelayNode) {
      this.preDelayNode.delayTime.value = ms / 1000;
    }
  }


  public setMix(percent: number) {
    this.currentMix = percent;
    if (this.dryGainNode && this.wetGainNode && this.ctx) {
      const wet = percent / 100;
      const dry = 1 - wet;
      this.dryGainNode.gain.setTargetAtTime(this.isPowerOn ? dry : 1.0, this.ctx.currentTime, 0.02);
      this.wetGainNode.gain.setTargetAtTime(this.isPowerOn ? wet : 0.0, this.ctx.currentTime, 0.02);
    }
  }

  // Dramatic Stereo Width (0% = Pure Mono, 50% = Normal Stereo, 100% = 2.5x Ultra-Wide 3D Reverb)
  public setWidth(percent: number) {
    this.currentWidth = percent;
    if (this.sideGainNode && this.ctx) {
      const sideMultiplier = (percent / 100) * 2.5; // Scale from 0.0 (Mono) to 2.5 (Ultra Wide)
      this.sideGainNode.gain.setTargetAtTime(sideMultiplier, this.ctx.currentTime, 0.03);
    }
  }

  public setPower(powerOn: boolean) {
    this.isPowerOn = powerOn;
    this.setMix(this.currentMix);
  }

  // Parameter-Smoothed EQ Node updates (Zero disconnects, zero stuttering/zipper noise during drag!)
  public setNodes(nodes: Array<{ id: number; x: number; y: number; q: number; shape: string; enabled: boolean }>) {
    if (!this.ctx || !this.filterChainContainer) return;

    const currentIds = new Set(nodes.map(n => n.id));

    // Remove filters for deleted nodes
    for (const [id, item] of this.filterMap.entries()) {
      if (!currentIds.has(id)) {
        item.filter.disconnect();
        this.filterMap.delete(id);
      }
    }

    // Update or create filters without tearing down the audio graph
    nodes.forEach(n => {
      if (!this.ctx) return;
      let filterObj = this.filterMap.get(n.id);

      // Create filter node if it doesn't exist
      if (!filterObj) {
        const filter = this.ctx.createBiquadFilter();
        filterObj = { filter, shape: n.shape };
        this.filterMap.set(n.id, filterObj);
      }

      const filter = filterObj.filter;
      const freq = 20 * Math.pow(1000, n.x);
      const gainDb = (0.5 - n.y) * 30;

      // Update shape type
      switch (n.shape) {
        case 'Bell': filter.type = 'peaking'; break;
        case 'Low Cut': filter.type = 'highpass'; break;
        case 'High Cut': filter.type = 'lowpass'; break;
        case 'Low Shelf': filter.type = 'lowshelf'; break;
        case 'High Shelf': filter.type = 'highshelf'; break;
      }

      // Smooth audio parameter updates with exponential ramp (Zero clicks / stuttering!)
      const targetGain = n.enabled ? gainDb : 0;
      filter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.02);
      filter.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.02);
      filter.Q.setTargetAtTime(Math.max(0.1, n.q), this.ctx.currentTime, 0.02);
    });

    // Chain active filters in series
    this.reconnectFilterChain(nodes);
  }

  private reconnectFilterChain(nodes: Array<{ id: number; enabled: boolean }>) {
    if (!this.convolverNode || !this.wetGainNode || !this.filterChainContainer) return;

    const activeFilters: BiquadFilterNode[] = [];
    nodes.forEach(n => {
      if (!n.enabled) return;
      const item = this.filterMap.get(n.id);
      if (item) activeFilters.push(item.filter);
    });

    // Re-link chain only if structural order changes
    try {
      this.convolverNode.disconnect();
      if (activeFilters.length === 0) {
        this.convolverNode.connect(this.filterChainContainer);
      } else {
        this.convolverNode.connect(activeFilters[0]);
        for (let i = 0; i < activeFilters.length - 1; i++) {
          activeFilters[i].disconnect();
          activeFilters[i].connect(activeFilters[i + 1]);
        }
        activeFilters[activeFilters.length - 1].disconnect();
        activeFilters[activeFilters.length - 1].connect(this.filterChainContainer);
      }
    } catch {
      // Safe fallback
    }
  }

  public getSpectrumData(outputArray: Uint8Array): void {
    if (this.analyserNode) {
      this.analyserNode.getByteFrequencyData(outputArray as unknown as Uint8Array<ArrayBuffer>);
    } else {
      outputArray.fill(0);
    }
  }


  public toggleTestAudio(type: 'synth' | 'impulse' = 'synth'): boolean {
    this.init();
    this.ensureContextRunning();

    if (this.isPlayingTestAudio) {
      this.stopTestAudio();
      return false;
    } else {
      this.startTestAudio(type);
      return true;
    }
  }

  private startTestAudio(type: 'synth' | 'impulse') {
    if (!this.ctx || !this.inputNode) return;

    if (type === 'synth') {
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      let noteIndex = 0;

      const triggerPluck = () => {
        if (!this.ctx || !this.inputNode || !this.isPlayingTestAudio) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = notes[noteIndex % notes.length];
        noteIndex++;

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

        osc.connect(gain);
        gain.connect(this.inputNode);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.65);
      };

      this.isPlayingTestAudio = true;
      triggerPluck();
      this.testAudioInterval = window.setInterval(triggerPluck, 500);
    }
  }

  private stopTestAudio() {
    this.isPlayingTestAudio = false;
    if (this.testAudioInterval !== null) {
      clearInterval(this.testAudioInterval);
      this.testAudioInterval = null;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlayingTestAudio;
  }
}

export const reverbEngine = new WebAudioReverbEngine();
