import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

export interface FundFlowData {
  layer: string;
  sector: string;
  inflow: number;
  outflow: number;
  netFlow: number;
  color?: string;
}

interface Props {
  data?: FundFlowData[];
  loading?: boolean;
}

const LAYER_CONFIG: Record<string, { color: string; label: string; order: number }> = {
  '北向资金': { color: '#FFD81D', label: '北向资金', order: 0 },
  '主力资金': { color: '#00F2FF', label: '主力资金', order: 1 },
  '散户资金': { color: '#FFB3B5', label: '散户资金', order: 2 },
  'industry': { color: '#FFD81D', label: '行业板块', order: 0 },
  'concept': { color: '#00F2FF', label: '概念板块', order: 1 },
  'region': { color: '#FFB3B5', label: '地域板块', order: 2 },
};

export function CapitalRiver({ data = [], loading = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  // Process data to add colors
  const fundData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      color: item.color || LAYER_CONFIG[item.layer]?.color || '#849495',
    }));
  }, [data]);

  // Get unique layers from data
  const layers = useMemo(() => {
    const uniqueLayers = [...new Set(fundData.map((d) => d.layer))];
    return uniqueLayers.sort((a, b) => {
      const orderA = LAYER_CONFIG[a]?.order ?? 999;
      const orderB = LAYER_CONFIG[b]?.order ?? 999;
      return orderA - orderB;
    });
  }, [fundData]);

  // Calculate layer Y positions
  const getLayerYPositions = useCallback(
    (height: number): Record<string, number> => {
      const positions: Record<string, number> = {};
      const totalLayers = layers.length || 3;
      layers.forEach((layer, index) => {
        positions[layer] = height * ((index + 1) / (totalLayers + 1));
      });
      // Default positions if no layers
      if (layers.length === 0) {
        positions['北向资金'] = height * 0.25;
        positions['主力资金'] = height * 0.5;
        positions['散户资金'] = height * 0.75;
      }
      return positions;
    },
    [layers]
  );

  const getRiverWidth = (flow: number) => {
    const maxWidth = 60;
    const minWidth = 8;
    const absFlow = Math.abs(flow);
    const scale = Math.min(absFlow / 1_000_000_000, 1); // Max at 1 billion
    return minWidth + scale * (maxWidth - minWidth);
  };

  const getFlowColor = (netFlow: number, baseColor: string) => {
    return netFlow > 0 ? baseColor : '#DE0541';
  };

  const drawRiver = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.clearRect(0, 0, width, height);

      const layerYPositions = getLayerYPositions(height);
      const displayLayers = layers.length > 0 ? layers : ['北向资金', '主力资金', '散户资金'];

      // Draw layer labels
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      displayLayers.forEach((layer) => {
        const isSelected = selectedLayer === layer;
        const config = LAYER_CONFIG[layer] || { color: '#849495', label: layer };
        const y = layerYPositions[layer] || height * 0.5;

        ctx.fillStyle = isSelected ? config.color : '#849495';
        ctx.globalAlpha = selectedLayer && !isSelected ? 0.3 : 1;
        ctx.fillText(config.label, 70, y);

        // Draw layer indicator line
        ctx.beginPath();
        ctx.moveTo(80, y);
        ctx.lineTo(110, y);
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = selectedLayer && !isSelected ? 0.3 : 0.6;
        ctx.stroke();
      });

      ctx.globalAlpha = 1;

      if (fundData.length === 0) {
        // Draw placeholder message
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#849495';
        ctx.fillText('暂无资金流向数据', width / 2, height / 2);
        return;
      }

      // Draw fund flows
      const sectorXStart = 130;
      const sectorXEnd = width - 120;
      const sectorWidth = (sectorXEnd - sectorXStart) / Math.max(fundData.length / 3, 1);

      fundData.forEach((data, index) => {
        const y = layerYPositions[data.layer];
        if (!y) return;

        const isLayerVisible = !selectedLayer || selectedLayer === data.layer;
        const isHovered = hoveredSector === data.sector;

        ctx.globalAlpha = isLayerVisible ? (isHovered ? 1 : 0.7) : 0.1;

        const riverWidth = getRiverWidth(data.netFlow);
        const color = getFlowColor(data.netFlow, data.color || '#849495');

        // Calculate X position based on sector index
        const sectorOffset = (index % Math.max(fundData.length / 3, 1)) * sectorWidth;
        const startX = sectorXStart + sectorOffset;
        const endX = Math.min(startX + sectorWidth * 0.8, sectorXEnd);

        // Draw flowing river path
        const gradient = ctx.createLinearGradient(startX, y, endX, y);
        gradient.addColorStop(0, color + '30'); // 19% opacity
        gradient.addColorStop(0.5, color + '60'); // 38% opacity
        gradient.addColorStop(1, color + '30');

        ctx.beginPath();
        ctx.moveTo(startX, y - riverWidth / 2);

        // Bezier curve for flowing effect
        const controlX1 = startX + (endX - startX) * 0.3;
        const controlX2 = startX + (endX - startX) * 0.7;
        const wave = Math.sin(Date.now() / 1000) * 3;

        ctx.bezierCurveTo(
          controlX1,
          y - riverWidth / 2 + wave,
          controlX2,
          y - riverWidth / 2 - wave,
          endX,
          y - riverWidth / 2
        );

        ctx.lineTo(endX, y + riverWidth / 2);

        ctx.bezierCurveTo(
          controlX2,
          y + riverWidth / 2 - wave,
          controlX1,
          y + riverWidth / 2 + wave,
          startX,
          y + riverWidth / 2
        );

        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw center flow line
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.bezierCurveTo(
          controlX1,
          y + Math.sin(Date.now() / 800) * 2,
          controlX2,
          y + Math.cos(Date.now() / 800) * 2,
          endX,
          y
        );
        ctx.strokeStyle = color;
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.globalAlpha = isLayerVisible ? (isHovered ? 1 : 0.8) : 0.1;
        ctx.stroke();

        // Draw sector node at end
        const nodeX = endX + 12;
        const nodeSize = isHovered ? 10 : 6;

        ctx.beginPath();
        ctx.arc(nodeX, y, nodeSize, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = isLayerVisible ? 1 : 0.1;
        ctx.fill();

        // Draw sector label
        ctx.font = isHovered ? 'bold 11px sans-serif' : '10px sans-serif';
        ctx.fillStyle = isHovered ? '#ffffff' : '#849495';
        ctx.textAlign = 'left';
        ctx.globalAlpha = isLayerVisible ? 1 : 0.2;

        // Truncate long sector names
        let sectorName = data.sector;
        if (sectorName.length > 4) {
          sectorName = sectorName.substring(0, 4) + '...';
        }
        ctx.fillText(sectorName, nodeX + 10, y - 4);

        // Draw flow value
        const flowText =
          data.netFlow > 0
            ? `+${(data.netFlow / 100000000).toFixed(1)}亿`
            : `${(data.netFlow / 100000000).toFixed(1)}亿`;
        ctx.font = '9px sans-serif';
        ctx.fillStyle = data.netFlow > 0 ? '#10B981' : '#EF4444';
        ctx.fillText(flowText, nodeX + 10, y + 8);
      });

      ctx.globalAlpha = 1;
    },
    [fundData, layers, selectedLayer, hoveredSector, getLayerYPositions]
  );

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
    const layerYPositions = getLayerYPositions(canvas.height);
    const displayLayers = layers.length > 0 ? layers : ['北向资金', '主力资金', '散户资金'];

    displayLayers.forEach((layer) => {
      const layerY = layerYPositions[layer];
      if (Math.abs(y - layerY) < 25 && x < 90) {
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
    const sectorXEnd = canvas.width - 120;
    const layerYPositions = getLayerYPositions(canvas.height);

    let foundSector: string | null = null;

    fundData.forEach((data) => {
      const layerY = layerYPositions[data.layer];
      if (!layerY) return;

      const sectorIndex = fundData.filter((d) => d.layer === data.layer).findIndex((d) => d.sector === data.sector);
      const sectorWidth = (sectorXEnd - 130) / Math.max(fundData.filter((d) => d.layer === data.layer).length, 1);
      const nodeX = 130 + sectorIndex * sectorWidth + sectorWidth * 0.8 + 12;

      // Check if mouse is near this sector
      if (Math.abs(y - layerY) < 18 && x > nodeX - 10 && x < nodeX + 60) {
        foundSector = data.sector;
      }
    });

    setHoveredSector(foundSector);
  };

  // Calculate totals for each layer
  const layerTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    fundData.forEach((d) => {
      totals[d.layer] = (totals[d.layer] || 0) + d.netFlow;
    });
    return totals;
  }, [fundData]);

  if (loading) {
    return (
      <div className="glass-panel p-4 rounded-xl h-full flex flex-col justify-between">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-base font-headline font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-400">water</span>
              资金河流图
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">实时资金流向可视化 - 资金如水，流动即趋势</p>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center text-slate-400">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400"></div>
            加载中...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-4 rounded-xl h-full flex flex-col justify-between">
      <div className="min-h-0 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-base font-headline font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-400">water</span>
              资金河流图
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">实时资金流向可视化 - 资金如水，流动即趋势</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300 transition-colors"
            >
              <span className="material-symbols-outlined text-xs">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
              {isPlaying ? '暂停' : '播放'}
            </button>

            {selectedLayer && (
              <button
                onClick={() => setSelectedLayer(null)}
                className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-[10px] hover:bg-cyan-500/30 transition-colors"
              >
                全部
              </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-3 text-[10px]">
          {(layers.length > 0 ? layers : ['北向资金', '主力资金', '散户资金']).map((layer) => {
            const config = LAYER_CONFIG[layer] || { color: '#849495', label: layer };
            return (
              <div key={layer} className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: config.color }}
                ></div>
                <span className="text-slate-400">{config.label}</span>
              </div>
            );
          })}
        </div>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={800}
          height={240}
          className="w-full h-auto cursor-pointer rounded-lg bg-slate-900/30"
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoveredSector(null)}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-700/50">
        {layers.slice(0, 3).map((layer) => {
          const total = layerTotals[layer] || 0;
          const config = LAYER_CONFIG[layer] || { color: '#849495', label: layer };
          return (
            <div key={layer} className="flex items-center justify-center gap-1.5">
              <div className="text-[10px] text-slate-500">{config.label}</div>
              <div
                className="text-sm font-mono font-bold leading-none"
                style={{ color: total >= 0 ? config.color : '#DE0541' }}
              >
                {total > 0 ? '+' : ''}
                {(total / 100000000).toFixed(1)}亿
              </div>
            </div>
          );
        })}
        {layers.length === 0 && (
          <>
            <div className="flex items-center justify-center gap-1.5">
              <div className="text-[10px] text-slate-500">北向资金</div>
              <div className="text-sm font-mono text-amber-400 leading-none">--</div>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <div className="text-[10px] text-slate-500">主力资金</div>
              <div className="text-sm font-mono text-cyan-400 leading-none">--</div>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <div className="text-[10px] text-slate-500">散户资金</div>
              <div className="text-sm font-mono text-rose-400 leading-none">--</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
