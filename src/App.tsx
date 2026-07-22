import React, { useState, useEffect, useRef } from 'react';
import { reverbEngine } from './dsp/WebAudioReverb';
import { EqNode, FilterShape, StereoPlacement, Preset } from './types/plugin';
import { PresetMenu } from './components/PresetMenu';
import { ContextMenu } from './components/ContextMenu';


// Professional Studio Palette (No Neon - Soft & Easy to See)
const NODE_COLORS = [
  '#E09F3E', // Warm Amber
  '#52B788', // Soft Mint Emerald
  '#4EA8DE', // Soft Sky Blue
  '#E76F51', // Soft Coral Terracotta
  '#9D4EDD', // Soft Lavender Violet
  '#2A9D8F', // Soft Deep Teal
  '#F4A261', // Warm Peach
  '#E56B6F'  // Soft Rose
];

const getNodeColor = (index: number) => NODE_COLORS[index % NODE_COLORS.length];

// Static Grid Frequencies (Hoisted outside component to eliminate GC overhead in 60 FPS render loop)
const GRID_FREQS = [
  { f: 20, label: '20' },
  { f: 50, label: '50' },
  { f: 100, label: '100' },
  { f: 200, label: '200' },
  { f: 500, label: '500' },
  { f: 1000, label: '1k' },
  { f: 2000, label: '2k' },
  { f: 5000, label: '5k' },
  { f: 10000, label: '10k' },
  { f: 20000, label: '20k' }
];

// Calculate single node EQ dB at xRatio with C-infinity smooth DSP filter curves (Zero kinks)
const getSingleNodeDbAtX = (xRatio: number, n: EqNode) => {
  if (!n.enabled) return 0;
  const nodeDb = (0.5 - n.y) * 30;
  const dist = xRatio - n.x;

  if (n.shape === 'Bell') {
    const width = 0.12 / n.q;
    return nodeDb * Math.exp(-(dist * dist) / (width * width));
  } else if (n.shape === 'Low Cut') {
    // Exact Mathematical Resonant High-Pass Filter (FabFilter style)
    const nodeDb = (0.5 - n.y) * 30; 
    const Q = Math.max(0.1, Math.pow(10, nodeDb / 20));
    const steepness = Math.max(0.5, n.q * 2.0); // Maps width to filter steepness
    const v = Math.pow(10, dist * 3 * steepness);
    const v2 = v * v;
    const denominator = Math.pow(1 - v2, 2) + v2 / (Q * Q);
    return 10 * Math.log10(Math.max(1e-10, (v2 * v2) / denominator));
  } else if (n.shape === 'High Cut') {
    // Exact Mathematical Resonant Low-Pass Filter (FabFilter style)
    const nodeDb = (0.5 - n.y) * 30; 
    const Q = Math.max(0.1, Math.pow(10, nodeDb / 20));
    const steepness = Math.max(0.5, n.q * 2.0); // Maps width to filter steepness
    const v = Math.pow(10, dist * 3 * steepness);
    const v2 = v * v;
    const denominator = Math.pow(1 - v2, 2) + v2 / (Q * Q);
    return 10 * Math.log10(Math.max(1e-10, 1 / denominator));
  } else if (n.shape === 'Low Shelf') {
    const slope = Math.max(0.5, n.q) * 9;
    const factor = 1 / (1 + Math.exp(dist * slope));
    return nodeDb * factor;
  } else if (n.shape === 'High Shelf') {
    const slope = Math.max(0.5, n.q) * 9;
    const factor = 1 / (1 + Math.exp(-dist * slope));
    return nodeDb * factor;
  }
  return 0;
};



// Calculate EQ Curve dB at xRatio considering all enabled nodes
const getEqDbAtX = (xRatio: number, nodeList: EqNode[]) => {
  let db = 0;
  for (let i = 0; i < nodeList.length; i++) {
    db += getSingleNodeDbAtX(xRatio, nodeList[i]);
  }
  return db;
};

// Real-time Analyzer Screen (FabFilter Pro-R style)
const AnalyzerScreen = ({ 
  power,
  nodes,
  setNodes
}: { 
  power: boolean;
  nodes: EqNode[];
  setNodes: React.Dispatch<React.SetStateAction<EqNode[]>>;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextNodeIdRef = useRef<number>(nodes.length + 1);


  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: number | null } | null>(null);

  // Hover & Active Node State
  const [hoverNodeId, setHoverNodeId] = useState<number | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const [activeModifier, setActiveModifier] = useState<string | null>(null);

  const isHoveringMenuRef = useRef(false);
  const hoverGraceTimeoutRef = useRef<number | null>(null);


  // Drag tracking refs
  const dragRef = useRef<{
    isDragging: boolean;
    startY: number;
    startX: number;
    initialX: number;
    initialY: number;
    initialQ: number;
  }>({ isDragging: false, startY: 0, startX: 0, initialX: 0, initialY: 0, initialQ: 1.0 });

  const getFreq = (xRatio: number) => 20 * Math.pow(1000, xRatio);
  const getXRatioFromFreq = (freq: number) => Math.log10(freq / 20) / 3;

  const formatFreq = (f: number) => {
    if (f >= 1000) return (f / 1000).toFixed(2) + ' kHz';
    return Math.round(f) + ' Hz';
  };

  const getDb = (yRatio: number) => (0.5 - yRatio) * 30; // +15 to -15 dB
  const formatDb = (db: number) => (db > 0 ? '+' : '') + db.toFixed(1) + ' dB';

  const fftDataRef = useRef<Uint8Array>(new Uint8Array(256));

  // Canvas Render Effect (Optimized 60-120 FPS Loop)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const noise = (x: number, t: number) => {
      return (Math.sin(x * 0.05 + t) + Math.sin(x * 0.1 - t * 0.8) + Math.sin(x * 0.01 + t * 0.5)) / 3;
    };

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (w <= 0 || h <= 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // Only resize canvas backing buffer when dimensions actually change (60 FPS Optimization!)
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.scale(dpr, dpr);
      }


      const baselineY = h * 0.5;

      // Real-time FFT
      reverbEngine.getSpectrumData(fftDataRef.current);
      const fft = fftDataRef.current;

      // Background Clear
      ctx.fillStyle = '#0a0b0e';
      ctx.fillRect(0, 0, w, h);

      // Frequency Grid Lines (Hoisted static frequency table)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < GRID_FREQS.length; i++) {
        const x = w * getXRatioFromFreq(GRID_FREQS[i].f);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h - 20);
      }
      for (let i = 1; i < 6; i++) {
        const y = h * (i / 6);
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // Bottom Frequency Label Axis Bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      for (let i = 0; i < GRID_FREQS.length; i++) {
        const x = w * getXRatioFromFreq(GRID_FREQS[i].f);
        ctx.fillText(GRID_FREQS[i].label, x, h - 6);
      }

      // 0 dB Horizontal Center Baseline Line
      ctx.beginPath();
      ctx.moveTo(0, baselineY);
      ctx.lineTo(w, baselineY);
      ctx.strokeStyle = 'rgba(242, 201, 76, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Left Percentage Scale (12%, 25%, 50%) in Sky Blue
      ctx.fillStyle = '#4EA8DE';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('50%', 6, baselineY - 4);
      ctx.fillText('25%', 6, h * 0.7 - 4);
      ctx.fillText('12%', 6, h * 0.85 - 4);

      // Right dB and Decay Scales (0, -6, -12, -18 / -45, -60, -75, -90)
      ctx.textAlign = 'right';
      ctx.fillStyle = '#F2C94C';
      ctx.fillText('0', w - 24, baselineY - 4);
      ctx.fillText('-6', w - 24, h * 0.6 - 4);
      ctx.fillText('-12', w - 24, h * 0.7 - 4);
      ctx.fillText('-18', w - 24, h * 0.8 - 4);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillText('-45', w - 6, baselineY - 4);
      ctx.fillText('-60', w - 6, h * 0.6 - 4);
      ctx.fillText('-75', w - 6, h * 0.7 - 4);
      ctx.fillText('-90', w - 6, h * 0.8 - 4);

      // FFT Spectrum Waves
      if (power) {
        ctx.beginPath();
        ctx.moveTo(0, h - 20);
        
        const step = 3;
        for (let x = 0; x <= w; x += step) {
          const xRatio = x / w;
          const eqDb = getEqDbAtX(xRatio, nodes);
          const eqMultiplier = Math.max(0, 1 + eqDb / 20); 

          const binIdx = Math.floor(xRatio * (fft.length - 1));
          const fftVal = fft[binIdx] / 255.0;

          const n = noise(x, time) * 0.5 + 0.5;
          const baseShape = Math.sin(xRatio * Math.PI) * 0.3 + 0.1;
          
          const amplitude = Math.max(fftVal * 0.95, (n * 0.2 + baseShape) * 0.25) * eqMultiplier;
          const y = (h - 20) - (amplitude * (h - 20) * 0.85);
          
          ctx.lineTo(x, y);
        }
        
        ctx.lineTo(w, h - 20);
        ctx.lineTo(0, h - 20);
        
        const fillGradient = ctx.createLinearGradient(0, 0, 0, h);
        fillGradient.addColorStop(0, 'rgba(60, 90, 130, 0.2)');
        fillGradient.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
        
        ctx.fillStyle = fillGradient;
        ctx.fill();
        
        const lineGradient = ctx.createLinearGradient(0, 0, w, 0);
        lineGradient.addColorStop(0, 'rgba(130, 175, 215, 0.6)');
        lineGradient.addColorStop(0.5, 'rgba(160, 200, 230, 0.7)');
        lineGradient.addColorStop(1, 'rgba(120, 160, 200, 0.6)');
        
        ctx.strokeStyle = lineGradient;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Individual Node Band Curves and Fills
      for (let idx = 0; idx < nodes.length; idx++) {
        const n = nodes[idx];
        if (!n.enabled) continue;
        const nodeColor = getNodeColor(idx);

        ctx.beginPath();
        let startX = 0;
        let endX = w;

        for (let x = 0; x <= w; x += 4) {
          const xRatio = x / w;
          const singleDb = getSingleNodeDbAtX(xRatio, n);
          const yRatio = 0.5 - (singleDb / 30) * 0.8;
          const y = h * yRatio;

          if (x === 0) {
            ctx.moveTo(x, y);
            startX = x;
          } else {
            ctx.lineTo(x, y);
          }
          endX = x;
        }

        ctx.lineTo(endX, baselineY);
        ctx.lineTo(startX, baselineY);
        ctx.closePath();
        ctx.fillStyle = `${nodeColor}1e`;
        ctx.fill();

        // Stroke Individual Band Line
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const xRatio = x / w;
          const singleDb = getSingleNodeDbAtX(xRatio, n);
          const yRatio = 0.5 - (singleDb / 30) * 0.8;
          const y = h * yRatio;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `${nodeColor}aa`;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Stem Line connecting node handle to 0 dB baseline
        const nx = n.x * w;
        const ny = n.y * h;
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(nx, baselineY);
        ctx.strokeStyle = `${nodeColor}66`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Composite Output Response Curve & Translucent Gold Fill
      ctx.beginPath();
      ctx.moveTo(0, baselineY);
      for (let x = 0; x <= w; x += 3) {
        const xRatio = x / w;
        const eqDb = getEqDbAtX(xRatio, nodes);
        const yRatio = 0.5 - (eqDb / 30) * 0.8;
        const y = h * yRatio;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, baselineY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(242, 201, 76, 0.15)';
      ctx.fill();

      // Main Composite Response Line with Glow
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const xRatio = x / w;
        const eqDb = getEqDbAtX(xRatio, nodes);
        const yRatio = 0.5 - (eqDb / 30) * 0.8;
        const y = h * yRatio;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.shadowColor = 'rgba(242, 201, 76, 0.5)';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#F2C94C';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.shadowBlur = 0;



      // 1. EQ Nodes with Unique Colors per Node Index
      nodes.forEach((n, idx) => {
        let nodeYRatio = n.y;
        if (n.shape === 'Low Cut' || n.shape === 'High Cut') {
          const singleDb = getSingleNodeDbAtX(n.x, n);
          nodeYRatio = 0.5 - (singleDb / 30) * 0.8;
        }
        const nx = n.x * w;
        const ny = nodeYRatio * h;
        const nodeColor = getNodeColor(idx);

        
        const isActive = activeNodeId === n.id;
        const isHover = hoverNodeId === n.id;


        
        // Node Outer Glow
        if (isActive || isHover) {
          ctx.beginPath();
          ctx.arc(nx, ny, 15, 0, Math.PI * 2);
          ctx.fillStyle = n.enabled ? `${nodeColor}33` : 'rgba(150, 150, 150, 0.2)';
          ctx.fill();
        }

        // Node Circle (Filled with distinct node color)
        ctx.beginPath();
        ctx.arc(nx, ny, 9, 0, Math.PI * 2);
        ctx.fillStyle = !n.enabled ? '#3a3e47' : isActive ? '#ffffff' : nodeColor;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = n.enabled ? '#000000' : '#888888';
        ctx.stroke();

        // Node Number Text (1, 2, 3...)
        ctx.fillStyle = !n.enabled ? '#aaaaaa' : isActive ? '#000000' : '#111111';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${idx + 1}`, nx, ny);
      });

      time += 0.03;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [power, nodes, hoverNodeId, activeNodeId, activeModifier, getEqDbAtX]);

  // Find Node at cursor
  const getNodeAtPos = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    let closestId: number | null = null;
    let minDist = 22; // 22px hit radius
    
    nodes.forEach(n => {
      let nodeYRatio = n.y;
      if (n.shape === 'Low Cut' || n.shape === 'High Cut') {
        const singleDb = getSingleNodeDbAtX(n.x, n);
        nodeYRatio = 0.5 - (singleDb / 30) * 0.8;
      }
      const nx = n.x * rect.width;
      const ny = nodeYRatio * rect.height;
      const dist = Math.hypot(nx - x, ny - y);
      if (dist < minDist) {
        minDist = dist;
        closestId = n.id;
      }
    });


    return { closestId, rect, x, y };
  };

  // Pointer Handlers with FabFilter Pro-R Modifiers (1.3 Alt/Opt, 1.4 Win/Cmd, 1.5 Shift)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Left click only
    setContextMenu(null);

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const { closestId, rect } = getNodeAtPos(e.clientX, e.clientY, canvas);

    if (closestId !== null) {
      setActiveNodeId(closestId);
      const targetNode = nodes.find(n => n.id === closestId);
      if (targetNode) {
        dragRef.current = {
          isDragging: true,
          startX: e.clientX,
          startY: e.clientY,
          initialX: targetNode.x,
          initialY: targetNode.y,
          initialQ: targetNode.q
        };
      }
    } else {
      // Clear selection on single click on empty space
      setActiveNodeId(null);
    }
  };

  // Create new node only on double click on canvas
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { closestId, rect } = getNodeAtPos(e.clientX, e.clientY, canvas);

    if (closestId === null) {
      const xRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const yRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const newNode: EqNode = {
        id: nextNodeIdRef.current++,
        x: xRatio,
        y: yRatio,
        q: 1.0,
        shape: 'Bell',
        stereo: 'Stereo',
        enabled: true
      };
      setNodes(prev => [...prev, newNode]);
      setActiveNodeId(newNode.id);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { closestId, rect } = getNodeAtPos(e.clientX, e.clientY, canvas);
    if (!dragRef.current.isDragging) {
      if (closestId !== null) {
        if (hoverGraceTimeoutRef.current) {
          clearTimeout(hoverGraceTimeoutRef.current);
          hoverGraceTimeoutRef.current = null;
        }
        setHoverNodeId(closestId);
      } else if (!isHoveringMenuRef.current) {
        if (!hoverGraceTimeoutRef.current) {
          hoverGraceTimeoutRef.current = window.setTimeout(() => {
            if (!isHoveringMenuRef.current) {
              setHoverNodeId(null);
            }
            hoverGraceTimeoutRef.current = null;
          }, 250);
        }
      }
    }


    // Check Modifier keys
    if (e.altKey) setActiveModifier('Alt');
    else if (e.metaKey || e.ctrlKey) setActiveModifier('Cmd');
    else if (e.shiftKey) setActiveModifier('Shift');
    else setActiveModifier(null);

    // Perform Drag with Modifiers
    if (dragRef.current.isDragging && activeNodeId !== null) {
      const deltaX = (e.clientX - dragRef.current.startX) / rect.width;
      const deltaY = (e.clientY - dragRef.current.startY) / rect.height;

      // 1.5 Shift key fine tune factor
      const scale = e.shiftKey ? 0.2 : 1.0;

      setNodes(prev => prev.map(n => {
        if (n.id !== activeNodeId) return n;

        // 1.3 Alt/Opt horizontal lock
        if (e.altKey) {
          return { ...n, x: Math.max(0, Math.min(1, dragRef.current.initialX + deltaX * scale)) };
        }

        // 1.4 Win/Cmd vertical Q adjustment
        if (e.metaKey || e.ctrlKey) {
          const qDelta = -deltaY * 5.0 * scale;
          return { ...n, q: Math.max(0.1, Math.min(10.0, dragRef.current.initialQ + qDelta)) };
        }

        // Standard Drag
        return {
          ...n,
          x: Math.max(0, Math.min(1, dragRef.current.initialX + deltaX * scale)),
          y: Math.max(0, Math.min(1, dragRef.current.initialY + deltaY * scale))
        };
      }));
    }
  };


  const handlePointerUp = () => {
    dragRef.current.isDragging = false;
    setActiveNodeId(null);
    setActiveModifier(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const targetId = activeNodeId || hoverNodeId;
    if (targetId !== null) {
      setNodes(prev => prev.map(n => {
        if (n.id !== targetId) return n;
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        return { ...n, q: Math.max(0.1, Math.min(10.0, n.q + delta)) };
      }));
    }
  };

  // 1.1 Right Click Menu Handler
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { closestId } = getNodeAtPos(e.clientX, e.clientY, canvas);
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: closestId });
  };

  const activeOrHoverNode = nodes.find(n => n.id === (activeNodeId !== null ? activeNodeId : hoverNodeId)) || null;



  // Icon Render Helpers
  const getShapeIcon = (shape: FilterShape) => {
    switch (shape) {
      case 'Bell': return '⩌';
      case 'Low Cut': return '◤';
      case 'High Cut': return '◥';
      case 'Low Shelf': return '⎽';
      case 'High Shelf': return '⎾';
    }
  };

  const getStereoIcon = (st: StereoPlacement) => {
    switch (st) {
      case 'Stereo': return '∞';
      case 'Left': return 'L';
      case 'Right': return 'R';
      case 'Mid': return 'M';
      case 'Side': return 'S';
    }
  };

  return (
    <div className="relative w-full h-full">
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full cursor-default touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      />

      {/* 1.2 Hover Interactive Popup Panel with Dynamic Top/Bottom Flip & Drag Translucency */}
      {activeOrHoverNode && (() => {
        const isDragging = activeNodeId !== null;
        const isNearTop = activeOrHoverNode.y < 0.35;
        const leftPercent = Math.min(85, Math.max(15, activeOrHoverNode.x * 100));
        const topPercent = activeOrHoverNode.y * 100;

        return (
          <div 
            onMouseEnter={() => {
              isHoveringMenuRef.current = true;
              if (hoverGraceTimeoutRef.current) {
                clearTimeout(hoverGraceTimeoutRef.current);
                hoverGraceTimeoutRef.current = null;
              }
            }}
            onMouseLeave={() => {
              isHoveringMenuRef.current = false;
              if (activeNodeId === null) {
                setHoverNodeId(null);
              }
            }}
            className={`absolute z-20 bg-[#181a20]/95 border border-white/20 rounded-lg p-2 shadow-2xl text-xs text-gray-200 backdrop-blur-md select-none flex flex-col gap-1.5 min-w-[140px] transition-opacity duration-150 ${
              isDragging ? 'opacity-25 pointer-events-none' : 'opacity-95 pointer-events-auto'
            }`}
            style={{
              left: `${leftPercent}%`,
              top: `${topPercent}%`,
              transform: isNearTop ? 'translate(-50%, 35%)' : 'translate(-50%, -135%)'
            }}
          >




          {/* Top Row: Power Toggle, Freq, Delete Cross */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1">
            <button
              onClick={() => setNodes(prev => prev.map(n => n.id === activeOrHoverNode.id ? { ...n, enabled: !n.enabled } : n))}
              className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold cursor-pointer transition-colors ${
                activeOrHoverNode.enabled ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50' : 'bg-neutral-800 text-gray-500 border border-white/10'
              }`}
              title="On/Off Node Switch"
            >
              ⏻
            </button>
            <span className="font-mono text-[11px] text-white font-semibold">
              {formatFreq(getFreq(activeOrHoverNode.x))}
            </span>
            <button
              onClick={() => setNodes(prev => prev.filter(n => n.id !== activeOrHoverNode.id))}
              className="text-gray-400 hover:text-red-400 text-xs px-1 cursor-pointer"
              title="Delete Node"
            >
              ✕
            </button>
          </div>

          {/* Middle Row: Shape Button, Gain */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => {
                const shapes: FilterShape[] = ['Bell', 'Low Cut', 'High Cut', 'Low Shelf', 'High Shelf'];
                const nextShape = shapes[(shapes.indexOf(activeOrHoverNode.shape) + 1) % shapes.length];
                setNodes(prev => prev.map(n => n.id === activeOrHoverNode.id ? { ...n, shape: nextShape } : n));
              }}
              className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[#F2C94C] font-bold text-[10px] flex items-center gap-1 cursor-pointer"
              title="Click to Cycle Filter Shape"
            >
              <span>{getShapeIcon(activeOrHoverNode.shape)}</span>
              <span>{activeOrHoverNode.shape}</span>
            </button>
            <span className="font-mono text-[11px] text-amber-400 font-bold">
              {formatDb(getDb(activeOrHoverNode.y))}
            </span>
          </div>

          {/* Bottom Row: Stereo Placement, Q Factor */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <button
              onClick={() => {
                const stereos: StereoPlacement[] = ['Stereo', 'Left', 'Right', 'Mid', 'Side'];
                const nextStereo = stereos[(stereos.indexOf(activeOrHoverNode.stereo) + 1) % stereos.length];
                setNodes(prev => prev.map(n => n.id === activeOrHoverNode.id ? { ...n, stereo: nextStereo } : n));
              }}
              className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-purple-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
              title="Click to Cycle Stereo Placement"
            >
              <span>{getStereoIcon(activeOrHoverNode.stereo)}</span>
              <span>{activeOrHoverNode.stereo}</span>
            </button>
            <span className="font-mono text-[10px] text-gray-400">
              Q: {activeOrHoverNode.q.toFixed(2)}
            </span>
          </div>

          {/* Active Drag Modifier Hint */}
          {activeModifier && (
            <div className="text-[9px] font-mono text-center text-[#F2C94C] bg-[#E09F3E]/20 rounded py-0.5 border border-[#E09F3E]/30 uppercase tracking-wider">
              Mode: {activeModifier === 'Alt' ? 'Freq Lock Y' : activeModifier === 'Cmd' ? 'Q Adjust' : 'Fine Tune'}
            </div>
          )}
        </div>
        );
      })()}


      {/* Right-Click Context Menu Overlay (matching example/rcl.png) */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={nodes.find(n => n.id === contextMenu.nodeId) || null}
          onClose={() => setContextMenu(null)}
          onToggleEnable={(id) => setNodes(prev => prev.map(n => n.id === id ? { ...n, enabled: !n.enabled } : n))}
          onInvertGain={(id) => setNodes(prev => prev.map(n => n.id === id ? { ...n, y: 1 - n.y } : n))}
          onChangeShape={(id, shape) => setNodes(prev => prev.map(n => n.id === id ? { ...n, shape } : n))}
          onChangeStereo={(id, stereo) => setNodes(prev => prev.map(n => n.id === id ? { ...n, stereo } : n))}
          onDeleteNode={(id) => setNodes(prev => prev.filter(n => n.id !== id))}
          onAddNode={(cx, cy) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const xRatio = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
            const yRatio = Math.max(0, Math.min(1, (cy - rect.top) / rect.height));
            setNodes(prev => [...prev, {
              id: nextNodeIdRef.current++,
              x: xRatio,
              y: yRatio,
              q: 1.0,
              shape: 'Bell',
              stereo: 'Stereo',
              enabled: true
            }]);
          }}
        />
      )}
    </div>
  );
};

// Reusable Knob Component with Circular LED Ring, Double-Click Reset & Value Display Screen
const Knob = ({ 
  label, 
  value, 
  onChange,
  unit = '%',
  defaultValue = 50,
  ledColor = '#E09F3E'
}: { 
  label: string;
  value: number; 
  onChange: (val: number) => void;
  unit?: string;
  defaultValue?: number;
  ledColor?: string;
}) => {
  const diameter = 76;
  const radius = 40;
  const strokeWidth = 4;
  const center = 48;

  // SVG Circumference for 270 degree arc sweep
  const circumference = 2 * Math.PI * radius; // ~251.32
  const maxArcLength = circumference * 0.75; // 270 deg = 188.5
  const strokeDashoffset = maxArcLength * (1 - value / 100);

  // Convert 0-100 to rotation (-135deg to +135deg)
  const rotation = -135 + (value / 100) * 270;

  const formattedValue = unit === 'ms' ? `${Math.round(value * 2.5)} ms` : `${Math.round(value)}%`;

  return (
    <div className="flex flex-col items-center justify-center gap-2 select-none">
      {/* Knob + Circular LED Ring Container */}
      <div 
        className="relative flex items-center justify-center cursor-pointer touch-none"
        style={{ width: 96, height: 96 }}
        onDoubleClick={() => onChange(defaultValue)}
        onPointerDown={(e) => {
          const startY = e.clientY;
          const startVal = value;
          const handleMove = (eMove: PointerEvent) => {
            const delta = startY - eMove.clientY;
            const newVal = Math.max(0, Math.min(100, startVal + delta));
            onChange(newVal);
          };
          const handleUp = () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
          };
          window.addEventListener('pointermove', handleMove);
          window.addEventListener('pointerup', handleUp);
        }}
      >
        {/* Outer Circular LED SVG Ring */}
        <svg className="absolute inset-0 w-full h-full transform rotate-[135deg]">
          {/* Background Arc Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${maxArcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Illuminated Dynamic LED Arc Fill */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={ledColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${maxArcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 4px ${ledColor}99)`,
              transition: 'stroke-dashoffset 0.05s ease-out'
            }}
          />
        </svg>

        {/* Inner Physical Knob Body */}
        <div 
          className="relative rounded-full shadow-2xl flex items-center justify-center"
          style={{
            width: diameter,
            height: diameter,
            background: 'linear-gradient(145deg, #22252c, #14161a)',
            boxShadow: `
              6px 6px 14px #0a0b0d,
              -4px -4px 10px #2a2e38,
              inset 2px 2px 4px rgba(255,255,255,0.06),
              inset -2px -2px 4px rgba(0,0,0,0.6)
            `
          }}
        >
          {/* Rotating Knob Pointer Line */}
          <div 
            className="absolute inset-0 flex justify-center"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div 
              className="w-[2.5px] h-1/4 mt-2 rounded-full shadow-[0_0_4px_#fff]"
              style={{ backgroundColor: ledColor }}
            ></div>
          </div>
        </div>
      </div>

      {/* Label Text */}
      <span className="text-[10px] tracking-widest font-bold text-gray-400 uppercase">
        {label}
      </span>

      {/* 3. Small Value Screen Display Badge (OLED Style) */}
      <div className="bg-[#0b0c10] border border-white/10 rounded-md px-2.5 shadow-inner flex items-center justify-center h-6 min-w-[56px]">
        <span className="font-mono text-[11px] font-bold text-[#F5F5F0] leading-none text-center flex items-center justify-center">
          {formattedValue}
        </span>
      </div>


    </div>
  );
};

export default function App() {
  const [decay, setDecay] = useState(60);
  const [preDelay, setPreDelay] = useState(30);
  const [mix, setMix] = useState(50);
  const [width, setWidth] = useState(80);
  
  const [power, setPower] = useState(true);

  // Preset State & User Preset Management
  const [currentPresetName, setCurrentPresetName] = useState('Vocal Hall');
  const [userPresets, setUserPresets] = useState<Preset[]>([]);

  // EQ Nodes state initialized from Default Factory Preset
  const [nodes, setNodes] = useState<EqNode[]>([
    { id: 1, x: 0.15, y: 0.65, q: 0.7, shape: 'Low Cut', stereo: 'Stereo', enabled: true },
    { id: 2, x: 0.45, y: 0.42, q: 1.2, shape: 'Bell', stereo: 'Stereo', enabled: true },
    { id: 3, x: 0.85, y: 0.38, q: 1.0, shape: 'High Cut', stereo: 'Stereo', enabled: true }
  ]);

  // Sync state changes to Web Audio DSP Engine
  useEffect(() => { reverbEngine.setDecay(decay); }, [decay]);
  useEffect(() => { reverbEngine.setPreDelay(preDelay); }, [preDelay]);
  useEffect(() => { reverbEngine.setMix(mix); }, [mix]);
  useEffect(() => { reverbEngine.setWidth(width); }, [width]);
  useEffect(() => { reverbEngine.setPower(power); }, [power]);
  useEffect(() => { reverbEngine.setNodes(nodes); }, [nodes]);



  // Preset Actions
  const handleSelectPreset = (preset: Preset) => {
    setCurrentPresetName(preset.name);
    setDecay(preset.decay);
    setPreDelay(preset.preDelay);
    setMix(preset.mix);
    setWidth(preset.width);
    setPower(preset.power);
    setNodes(preset.nodes);
  };

  const handleSaveCurrentPreset = (name: string) => {
    const newPreset: Preset = {
      id: `user-${Date.now()}`,
      name,
      isFactory: false,
      decay,
      preDelay,
      mix,
      width,
      sync: false,
      power,
      nodes: [...nodes]
    };
    setUserPresets(prev => [...prev, newPreset]);
    setCurrentPresetName(name);
  };

  const handleDeletePreset = (id: string) => {
    setUserPresets(prev => prev.filter(p => p.id !== id));
    if (currentPresetName) setCurrentPresetName('Custom');
  };

  const handleRenamePreset = (id: string, newName: string) => {
    setUserPresets(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    setCurrentPresetName(newName);
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-8 select-none">
      {/* Main Plugin Body */}
      <div 
        className="rounded-[32px] p-8 w-full max-w-5xl"
        style={{
          background: '#1c1e22',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 1px 1px 2px rgba(255,255,255,0.1)'
        }}
      >
        {/* Topbar Header with Logo on Top Left & Centered OPHANIM Title */}
        <div className="flex items-center justify-between mb-6 px-2 relative min-h-[56px]">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Archangel DSP Logo" className="h-[56px] w-auto object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" />
          </div>
          <h1 className="text-[#F5F5F0] font-cinzel tracking-[0.55em] text-lg font-medium uppercase absolute left-1/2 -translate-x-1/2">OPHANIM</h1>
          <div className="w-14"></div>
        </div>



        {/* Main 2-Row Vertical Layout */}
        <div className="flex flex-col gap-5 h-[630px]">
          
          {/* Expanded Full-Width Equalizer Screen */}
          <div className="flex-1 rounded-2xl relative overflow-hidden bg-[#0a0a0c]">
            {/* Preset Button Upper Left Side */}
            <div className="absolute top-3 left-3 z-30">
              <PresetMenu
                currentPresetName={currentPresetName}
                onSelectPreset={handleSelectPreset}
                onSaveCurrentPreset={handleSaveCurrentPreset}
                onDeletePreset={handleDeletePreset}
                onRenamePreset={handleRenamePreset}
                userPresets={userPresets}
              />
            </div>



            <AnalyzerScreen power={power} nodes={nodes} setNodes={setNodes} />
            
            {/* Inner shadow overlay */}
            <div 
              className="pointer-events-none absolute inset-0 rounded-2xl" 
              style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,1), inset 0 0 40px rgba(0,0,0,0.5)' }}
            ></div>
          </div>

          {/* Bottom Horizontal Control Enclosure with All Knobs & Power Switch */}
          <div 
            className="h-52 rounded-2xl flex flex-col items-center justify-between py-4 px-8 relative"
            style={{
              background: 'linear-gradient(180deg, #131418, #0e0f12)',
              boxShadow: 'inset 0 0 15px rgba(0,0,0,0.6), 0 4px 20px rgba(0,0,0,0.3)'
            }}
          >
            {/* Knobs Row */}
            <div className="w-full flex items-center justify-around">
              {/* DECAY Knob */}
              <Knob label="DECAY" value={decay} onChange={setDecay} unit="%" ledColor="#E09F3E" />

              {/* PRE-DELAY Knob */}
              <Knob label="PRE-DELAY" value={preDelay} onChange={setPreDelay} unit="ms" ledColor="#52B788" />

              {/* Center ON/OFF Power Switch with LED */}
              <div className="flex flex-col items-center justify-center relative self-center mb-2">
                {/* Power Status LED */}
                <div 
                  className="w-2.5 h-2.5 rounded-full absolute -top-4 transition-all"
                  style={{
                    background: power ? '#E63946' : '#330000',
                    boxShadow: power ? '0 0 10px #E63946, 0 0 18px #E63946' : 'inset 1px 1px 2px rgba(0,0,0,0.8)'
                  }}
                ></div>

                <div 
                  className="w-20 h-20 rounded-full cursor-pointer flex items-center justify-center transition-all hover:scale-105"
                  style={{
                    background: 'linear-gradient(145deg, #d4d4d4, #b3b3b3)',
                    boxShadow: `
                      0 8px 18px rgba(0,0,0,0.6),
                      inset 2px 2px 4px rgba(255,255,255,0.8),
                      inset -2px -2px 4px rgba(0,0,0,0.3)
                    `,
                    transform: power ? 'scale(0.96)' : 'scale(1)',
                  }}
                  onClick={() => setPower(!power)}
                >
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(145deg, #e6e6e6, #cccccc)',
                      boxShadow: 'inset 0 0 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    <span className="text-xs text-gray-700 font-bold">⏻</span>
                  </div>
                </div>
                <span className="text-[10px] tracking-widest font-bold text-gray-500 uppercase mt-2">POWER</span>
              </div>

              {/* MIX Knob */}
              <Knob label="MIX" value={mix} onChange={setMix} unit="%" ledColor="#4EA8DE" />

              {/* WIDTH Knob */}
              <Knob label="WIDTH" value={width} onChange={setWidth} unit="%" ledColor="#E76F51" />
            </div>

            {/* 2. Centered "ARCHANGEL DSP" Brand Text at Bottom Bar Outer Enclosure */}
            <div className="text-[10px] font-serif tracking-[0.3em] font-bold text-gray-500 uppercase">
              ARCHANGEL DSP
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}



