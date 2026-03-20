import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// 节点数据
interface SectorNode {
  id: string
  name: string
  marketCap: number
  flow: number
  change: number
  group: number
  x?: number
  y?: number
}

// 连线数据
interface SectorLink {
  source: string
  target: string
  value: number
  type: 'positive' | 'negative'
}

// 生成模拟数据
const generateMockData = () => {
  const nodes: SectorNode[] = [
    { id: '1', name: '新能源', marketCap: 8500, flow: 67.3, change: 3.2, group: 1 },
    { id: '2', name: '锂电池', marketCap: 4200, flow: 34.2, change: 2.8, group: 1 },
    { id: '3', name: '光伏', marketCap: 3800, flow: 28.5, change: 2.1, group: 1 },
    { id: '4', name: '储能', marketCap: 2900, flow: 15.8, change: 1.9, group: 1 },
    { id: '5', name: '银行', marketCap: 12000, flow: 45.2, change: 1.2, group: 2 },
    { id: '6', name: '保险', marketCap: 5600, flow: 12.3, change: 0.8, group: 2 },
    { id: '7', name: '证券', marketCap: 4800, flow: -8.5, change: -0.5, group: 2 },
    { id: '8', name: '科技', marketCap: 9200, flow: -67.5, change: -2.8, group: 3 },
    { id: '9', name: '半导体', marketCap: 6500, flow: -45.2, change: -2.1, group: 3 },
    { id: '10', name: '软件', marketCap: 3800, flow: -22.3, change: -1.5, group: 3 },
    { id: '11', name: '医药', marketCap: 7200, flow: -12.1, change: -0.8, group: 4 },
    { id: '12', name: '医疗器械', marketCap: 3400, flow: 8.5, change: 0.5, group: 4 },
    { id: '13', name: '消费', marketCap: 6800, flow: 23.4, change: 1.5, group: 5 },
    { id: '14', name: '白酒', marketCap: 5200, flow: 18.9, change: 1.2, group: 5 },
    { id: '15', name: '汽车', marketCap: 5800, flow: 15.6, change: 0.9, group: 6 },
    { id: '16', name: '军工', marketCap: 4200, flow: 12.8, change: 0.7, group: 7 },
    { id: '17', name: '地产', marketCap: 3600, flow: -45.6, change: -3.2, group: 8 },
    { id: '18', name: '建材', marketCap: 2800, flow: -18.9, change: -1.8, group: 8 },
  ]

  const links: SectorLink[] = [
    { source: '1', target: '2', value: 0.85, type: 'positive' },
    { source: '1', target: '3', value: 0.78, type: 'positive' },
    { source: '1', target: '4', value: 0.72, type: 'positive' },
    { source: '2', target: '3', value: 0.65, type: 'positive' },
    { source: '5', target: '6', value: 0.68, type: 'positive' },
    { source: '5', target: '7', value: 0.55, type: 'positive' },
    { source: '8', target: '9', value: 0.82, type: 'positive' },
    { source: '8', target: '10', value: 0.75, type: 'positive' },
    { source: '9', target: '10', value: 0.70, type: 'positive' },
    { source: '11', target: '12', value: 0.62, type: 'positive' },
    { source: '13', target: '14', value: 0.58, type: 'positive' },
    { source: '1', target: '8', value: 0.65, type: 'negative' },
    { source: '1', target: '5', value: 0.45, type: 'negative' },
    { source: '5', target: '8', value: 0.55, type: 'negative' },
    { source: '2', target: '9', value: 0.48, type: 'negative' },
  ]

  return { nodes, links }
}

export default function SectorNetworkGraph() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [nodes, setNodes] = useState<SectorNode[]>([])
  const [links] = useState<SectorLink[]>(generateMockData().links)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  // 初始化节点位置
  useEffect(() => {
    const { nodes: initialNodes } = generateMockData()
    const width = 800
    const height = 500
    const centerX = width / 2
    const centerY = height / 2

    // 按组分布节点
    const grouped = initialNodes.map((node, i) => {
      const groupIndex = node.group
      const angle = (groupIndex / 8) * Math.PI * 2 + (i % 3) * 0.3
      const radius = 150 + (i % 2) * 50
      return {
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      }
    })

    setNodes(grouped)
  }, [])

  // 获取节点颜色
  const getNodeColor = (flow: number) => {
    if (flow > 20) return '#00F2FF'
    if (flow > 0) return '#00DBE7'
    if (flow > -20) return '#849495'
    return '#DE0541'
  }

  // 获取节点大小
  const getNodeSize = (marketCap: number) => {
    return Math.sqrt(marketCap / 100) + 10
  }

  // 处理拖拽
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault()
    setSelectedNode(nodeId)
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!selectedNode || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom

    setNodes(prev => prev.map(n => n.id === selectedNode ? { ...n, x, y } : n))
  }, [selectedNode, zoom])

  const handleMouseUp = () => {
    setSelectedNode(null)
  }

  const selectedNodeData = useMemo(() => 
    nodes.find(n => n.id === selectedNode),
    [nodes, selectedNode]
  )

  return (
    <div className="w-full h-full flex flex-col">
      {/* Controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-fluid-text-muted">
            <span className="w-2 h-2 rounded-full bg-fluid-primary" />
            Positive Correlation
          </div>
          <div className="flex items-center gap-2 text-xs text-fluid-text-muted">
            <span className="w-2 h-2 rounded-full bg-fluid-secondary" />
            Negative Correlation
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
            className="p-1.5 rounded bg-fluid-surface-container text-fluid-text hover:bg-fluid-surface-high"
          >
            <span className="material-symbols-outlined text-sm">zoom_out</span>
          </button>
          <span className="text-xs text-fluid-text-muted font-mono-data">{Math.round(zoom * 100)}%</span>
          <button 
            onClick={() => setZoom(z => Math.min(2, z + 0.1))}
            className="p-1.5 rounded bg-fluid-surface-container text-fluid-text hover:bg-fluid-surface-high"
          >
            <span className="material-symbols-outlined text-sm">zoom_in</span>
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative glass-panel rounded-xl overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          viewBox="0 0 800 500"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <g transform={`scale(${zoom})`}>
            {/* Links */}
            {links.map((link, i) => {
              const source = nodes.find(n => n.id === link.source)
              const target = nodes.find(n => n.id === link.target)
              if (!source?.x || !target?.x) return null
              return (
                <line
                  key={i}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={link.type === 'positive' ? '#00F2FF30' : '#DE054130'}
                  strokeWidth={link.value * 3}
                />
              )
            })}

            {/* Nodes */}
            {nodes.map((node) => (
              <g
                key={node.id}
                transform={`translate(${node.x || 0}, ${node.y || 0})`}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                className="cursor-pointer hover:opacity-80"
              >
                <circle
                  r={getNodeSize(node.marketCap)}
                  fill="#1D2026"
                  stroke={getNodeColor(node.flow)}
                  strokeWidth={2}
                  className="transition-all"
                />
                <text
                  y={-getNodeSize(node.marketCap) - 8}
                  textAnchor="middle"
                  fill="#E1E2EB"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                >
                  {node.name}
                </text>
                <text
                  y={5}
                  textAnchor="middle"
                  fill={getNodeColor(node.flow)}
                  fontSize="9"
                  fontFamily="JetBrains Mono"
                >
                  {node.flow > 0 ? '+' : ''}{node.flow}B
                </text>
              </g>
            ))}
          </g>
        </svg>

        {/* Selected Node Info */}
        {selectedNodeData && (
          <div className="absolute bottom-4 right-4 glass-panel p-4 rounded-lg max-w-xs">
            <h4 className="font-headline font-bold text-fluid-text mb-2">{selectedNodeData.name}</h4>
            <div className="space-y-1 text-xs font-mono-data">
              <div className="flex justify-between">
                <span className="text-fluid-text-muted">Market Cap:</span>
                <span className="text-fluid-text">{selectedNodeData.marketCap}亿</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fluid-text-muted">Flow:</span>
                <span className={selectedNodeData.flow > 0 ? 'text-fluid-primary' : 'text-fluid-secondary'}>
                  {selectedNodeData.flow > 0 ? '+' : ''}{selectedNodeData.flow}亿
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-fluid-text-muted">Change:</span>
                <span className={selectedNodeData.change > 0 ? 'text-fluid-primary' : 'text-fluid-secondary'}>
                  {selectedNodeData.change > 0 ? '+' : ''}{selectedNodeData.change}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
