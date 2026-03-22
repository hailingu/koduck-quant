import React, { useEffect, useRef, useState, useCallback } from 'react';

interface FundFlowData {
  layer: string;
  sector: string;
  inflow: number;
  outflow: number;
  netFlow: number;
  color: string;
}

interface RiverNode {
  id: string;
  name: string;
  x: number;
  y: number;
  flow: number;
  color: string;
  layer: 'northbound' | 'main' | 'retail';
}

interface RiverFlow {
  from: string;
  to: string;
  value: number;
  color: string;
}

interface Props {
  useMock?: boolean;
}

// Mock data for fund flows
const mockFundData: FundFlowData[] = [
  { layer: '北向资金', sector: '银行', inflow: 2400000000, outflow: 800000000, netFlow: 1600000000, color: '#FFD81D' },
  { layer: '北向资金', sector: '消费', inflow: 1200000000, outflow: 400000000, netFlow: 800000000, color: '#FFD81D' },
  { layer: '北向资金', sector: '医药', inflow: 800000000, outflow: 600000000, netFlow: 200000000, color: '#FFD81D' },
  { layer: '主力资金', sector: '科技', inflow: 4500000000, outflow: 1200000000, netFlow: 3300000000, color: '#00F2FF' },
  { layer: '主力资金', sector: '新能源', inflow: 3200000000, outflow: 900000000, netFlow: 2300000000, color: '#00F2FF' },
  { layer: '主力资金', sector: '金融', inflow: 2800000000, outflow: 1100000000, netFlow: 1700000000, color: '#00F2FF' },
  { layer: '散户资金', sector: '地产', inflow: 600000000, outflow: 1400000000, netFlow: -800000000, color: '#FFB3B5' },
  { layer: '散户资金', sector: '传媒', inflow: 400000000, outflow: 800000000, netFlow: -400000000, color: '#FFB3B5' },
];

export function CapitalRiver({ useMock = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);
  
  // Particle system for flowing animation
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
  }>>([]);

  const getRiverWidth = (flow: number) => {
    const maxWidth = 80;
    const minWidth = 10;
    const absFlow = Math.abs(flow);
    return minWidth + Math.log10(absFlow / 1000000 + 1) / 4 * (maxWidth - minWidth);
  };

  const getFlowColor = (netFlow: number, baseColor: string) => {
    if (netFlow > 0) {
      // Inflow - green tones
      return baseColor;
    } else {
      // Outflow - red tones
      return '#DE0541';
    }
  };

  const drawRiver = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);
    
    const layers = ['北向资金', '主力资金', '散户资金'];
    const layerColors = ['#FFD81D', '#00F2FF', '#FFB3B5'];
    const layerYPositions = [height * 0.25, height * 0.5, height * 0.75];
    
    // Draw layer labels
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    layers.forEach((layer, index) => {
      const isSelected = selectedLayer === layer;
      ctx.fillStyle = isSelected ? layerColors[index] : '#849495';
      ctx.globalAlpha = selectedLayer && !isSelected ? 0.3 : 1;
      ctx.fillText(layer, 80, layerYPositions[index]);
      
      // Draw layer indicator line
      ctx.beginPath();
      ctx.moveTo(90, layerYPositions[index]);
      ctx.lineTo(120, layerYPositions[index]);
      ctx.strokeStyle = layerColors[index];
      ctx.lineWidth = 2;
      ctx.globalAlpha = selectedLayer && !isSelected ? 0.3 : 0.6;
      ctx.stroke();
    });
    
    ctx.globalAlpha = 1;
    
    // Draw fund flows
    const sectorXStart = 150;
    const sectorXEnd = width - 100;
    
    mockFundData.forEach((data) => {
      const layerIndex = layers.indexOf(data.layer);
      if (layerIndex === -1) return;
      
      const isLayerVisible = !selectedLayer || selectedLayer === data.layer;
      const isHovered = hoveredSector === data.sector;
      
      ctx.globalAlpha = isLayerVisible ? (isHovered ? 1 : 0.7) : 0.1;
      
      const y = layerYPositions[layerIndex];
      const riverWidth = getRiverWidth(data.netFlow);
      const color = getFlowColor(data.netFlow, data.color);
      
      // Draw flowing river path
      const gradient = ctx.createLinearGradient(sectorXStart, y, sectorXEnd, y);
      gradient.addColorStop(0, color + '40');  // 25% opacity
      gradient.addColorStop(0.5, color + '80'); // 50% opacity
      gradient.addColorStop(1, color + '40');
      
      ctx.beginPath();
      ctx.moveTo(sectorXStart, y - riverWidth / 2);
      
      // Bezier curve for flowing effect
      const controlX1 = sectorXStart + (sectorXEnd - sectorXStart) * 0.3;
      const controlX2 = sectorXStart + (sectorXEnd - sectorXStart) * 0.7;
      
      ctx.bezierCurveTo(
        controlX1, y - riverWidth / 2 + Math.sin(Date.now() / 1000) * 5,
        controlX2, y - riverWidth / 2 + Math.cos(Date.now() / 1000) * 5,
        sectorXEnd, y - riverWidth / 2
      );
      
      ctx.lineTo(sectorXEnd, y + riverWidth / 2);
      
      ctx.bezierCurveTo(
        controlX2, y + riverWidth / 2 + Math.cos(Date.now() / 1000) * 5,
        controlX1, y + riverWidth / 2 + Math.sin(Date.now() / 1000) * 5,
        sectorXStart, y + riverWidth / 2
      );
      
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Draw center flow line
      ctx.beginPath();
      ctx.moveTo(sectorXStart, y);
      ctx.bezierCurveTo(
        controlX1, y + Math.sin(Date.now() / 800) * 3,
        controlX2, y + Math.cos(Date.now() / 800) * 3,
        sectorXEnd, y
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.globalAlpha = isLayerVisible ? (isHovered ? 1 : 0.8) : 0.1;
      ctx.stroke();
      
      // Draw sector node at end
      const nodeX = sectorXEnd + 20;
      const nodeSize = isHovered ? 12 : 8;
      
      ctx.beginPath();
      ctx.arc(nodeX, y, nodeSize, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = isLayerVisible ? 1 : 0.1;
      ctx.fill();
      
      // Draw sector label
      ctx.font = isHovered ? 'bold 12px sans-serif' : '11px sans-serif';
      ctx.fillStyle = isHovered ? '#ffffff' : '#849495';
      ctx.textAlign = 'left';
      ctx.globalAlpha = isLayerVisible ? 1 : 0.2;
      ctx.fillText(data.sector, nodeX + 15, y);
      
      // Draw flow value
      const flowText = data.netFlow > 0 
        ? `+${(data.netFlow / 100000000).toFixed(1)}亿`
        : `${(data.netFlow / 100000000).toFixed(1)}亿`;
      ctx.font = '10px sans-serif';
      ctx.fillStyle = data.netFlow > 0 ? '#10B981' : '#EF4444';
      ctx.fillText(flowText, nodeX + 15, y + 14);
    });
    
    ctx.globalAlpha = 1;
  }, [selectedLayer, hoveredSector]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    drawRiver(ctx, canvas.width, canvas.height);
    
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [drawRiver, isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate, isPlaying]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicked on layer label
    const layers = ['北向资金', '主力资金', '散户资金'];
    const layerYPositions = [canvas.height * 0.25, canvas.height * 0.5, canvas.height * 0.75];
    
    layers.forEach((layer, index) => {
      const layerY = layerYPositions[index];
      if (Math.abs(y - layerY) < 30 && x < 100) {
        setSelectedLayer(selectedLayer === layer ? null : layer);
      }
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Find hovered sector
    const sectorXEnd = canvas.width - 100;
    const layers = ['北向资金', '主力资金', '散户资金'];
    const layerYPositions = [canvas.height * 0.25, canvas.height * 0.5, canvas.height * 0.75];
    
    let foundSector: string | null = null;
    
    mockFundData.forEach((data) => {
      const layerIndex = layers.indexOf(data.layer);
      if (layerIndex === -1) return;
      
      const layerY = layerYPositions[layerIndex];
      const nodeX = sectorXEnd + 20;
      
      // Check if mouse is near this sector
      if (Math.abs(y - layerY) < 20 && x > nodeX && x < nodeX + 100) {
        foundSector = data.sector;
      }
    });
    
    setHoveredSector(foundSector);
  };

  return (
    <div className="glass-panel p-6 rounded-xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400">water</span>
            资金河流图
          </h2>
          <p className="text-xs text-slate-400 mt-1">实时资金流向可视化 - 资金如水，流动即趋势</p>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-300 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
            {isPlaying ? '暂停' : '播放'}
          </button>
          
          {selectedLayer && (
            <button
              onClick={() => setSelectedLayer(null)}
              className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs hover:bg-cyan-500/30 transition-colors"
            >
              显示全部
            </button>
          )}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#FFD81D]"></div>
          <span className="text-slate-400">北向资金</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#00F2FF]"></div>
          <span className="text-slate-400">主力资金</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#FFB3B5]"></div>
          <span className="text-slate-400">散户资金</span>
        </div>
      </div>
      
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={300}
        className="w-full h-auto cursor-pointer rounded-lg bg-slate-900/30"
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setHoveredSector(null)}
      />
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700">
        <div className="text-center">
          <div className="text-xs text-slate-500">北向净流入</div>
          <div className="text-lg font-mono text-amber-400">+26.0亿</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-500">主力净流入</div>
          <div className="text-lg font-mono text-cyan-400">+73.0亿</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-500">散户净流入</div>
          <div className="text-lg font-mono text-rose-400">-12.0亿</div>
        </div>
      </div>
    </div>
  );
}
