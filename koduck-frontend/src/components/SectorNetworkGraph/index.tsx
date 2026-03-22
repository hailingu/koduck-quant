import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'

// 节点数据
interface SectorNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  marketCap: number
  flow: number
  change: number
  group: number
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

// 连线数据
interface SectorLink extends d3.SimulationLinkDatum<SectorNode> {
  source: string | SectorNode
  target: string | SectorNode
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
    { source: '1', target: '8', value: -0.65, type: 'negative' },
    { source: '1', target: '5', value: -0.45, type: 'negative' },
    { source: '5', target: '8', value: -0.55, type: 'negative' },
    { source: '2', target: '9', value: -0.48, type: 'negative' },
  ]

  return { nodes, links }
}

export default function SectorNetworkGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<d3.Simulation<SectorNode, SectorLink> | null>(null)
  const [nodes, setNodes] = useState<SectorNode[]>([])
  const [links, setLinks] = useState<SectorLink[]>([])
  const [selectedNode, setSelectedNode] = useState<SectorNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [isSimulating, setIsSimulating] = useState(true)

  const data = useMemo(() => generateMockData(), [])

  // 获取节点颜色
  const getNodeColor = useCallback((flow: number) => {
    if (flow > 20) return '#00F2FF'
    if (flow > 0) return '#00DBE7'
    if (flow > -20) return '#849495'
    return '#DE0541'
  }, [])

  // 获取节点大小
  const getNodeSize = useCallback((marketCap: number) => {
    return Math.sqrt(marketCap / 100) + 8
  }, [])

  // 初始化 D3 力导向模拟
  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    // 深拷贝节点和连线数据
    const initialNodes = data.nodes.map(n => ({ ...n }))
    const initialLinks = data.links.map(l => ({ ...l }))

    setNodes(initialNodes)
    setLinks(initialLinks)

    // 创建力导向模拟
    const simulation = d3.forceSimulation<SectorNode>(initialNodes)
      .force('link', d3.forceLink<SectorNode, SectorLink>(initialLinks)
        .id(d => d.id)
        .distance(100)
        .strength(d => Math.abs(d.value) * 0.5)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SectorNode>().radius(d => getNodeSize(d.marketCap) + 5))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))

    simulation.on('tick', () => {
      setNodes([...initialNodes])
      setLinks([...initialLinks])
    })

    simulationRef.current = simulation

    // 5秒后停止模拟以节省性能
    const timer = setTimeout(() => {
      simulation.stop()
      setIsSimulating(false)
    }, 5000)

    return () => {
      clearTimeout(timer)
      simulation.stop()
    }
  }, [data, getNodeSize])

  // 处理节点拖拽
  const handleNodeDrag = useCallback((event: React.MouseEvent, node: SectorNode) => {
    event.preventDefault()
    if (!simulationRef.current) return

    const svg = svgRef.current
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const startX = event.clientX - rect.left
    const startY = event.clientY - rect.top

    // 固定节点位置
    node.fx = node.x
    node.fy = node.y

    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX - rect.left) / zoom
      const y = (e.clientY - rect.top) / zoom
      
      node.fx = x
      node.fy = y
      
      simulationRef.current?.alpha(0.3).restart()
    }

    const handleMouseUp = () => {
      // 双击固定，单击解除固定
      if (event.detail === 2) {
        // 保持固定
      } else {
        node.fx = null
        node.fy = null
      }
      
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [zoom])

  // 获取连线的实际坐标
  const getLinkCoords = useCallback((link: SectorLink) => {
    const source = typeof link.source === 'string' 
      ? nodes.find(n => n.id === link.source)
      : link.source
    const target = typeof link.target === 'string'
      ? nodes.find(n => n.id === link.target)
      : link.target
    
    if (!source || !target) return null
    return { source, target }
  }, [nodes])

  // 计算关联的节点
  const connectedNodes = useMemo(() => {
    if (!hoveredNode) return new Set<string>()
    
    const connected = new Set<string>()
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      
      if (sourceId === hoveredNode) connected.add(targetId)
      if (targetId === hoveredNode) connected.add(sourceId)
    })
    return connected
  }, [hoveredNode, links])

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
          <div className="flex items-center gap-2 text-xs text-fluid-text-muted ml-4">
            <span className="material-symbols-outlined text-[12px] text-fluid-primary">moving</span>
            Capital Flow
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setZoom(1)
              simulationRef.current?.alpha(0.5).restart()
            }}
            className="px-2 py-1 rounded bg-fluid-surface-container text-fluid-text hover:bg-fluid-surface-high text-xs"
          >
            Reset
          </button>
          <button 
            onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
            className="p-1.5 rounded bg-fluid-surface-container text-fluid-text hover:bg-fluid-surface-high"
          >
            <span className="material-symbols-outlined text-sm">zoom_out</span>
          </button>
          <span className="text-xs text-fluid-text-muted font-mono-data w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button 
            onClick={() => setZoom(z => Math.min(2, z + 0.1))}
            className="p-1.5 rounded bg-fluid-surface-container text-fluid-text hover:bg-fluid-surface-high"
          >
            <span className="material-symbols-outlined text-sm">zoom_in</span>
          </button>
        </div>
      </div>

      {/* Graph */}
      <div 
        ref={containerRef}
        className="flex-1 relative glass-panel rounded-xl overflow-hidden data-grid"
      >
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          style={{ minHeight: '400px' }}
        >
          <g transform={`scale(${zoom})`}>
            {/* Background Grid */}
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="#3A494B" opacity="0.3" />
              </pattern>
              <marker
                id="arrow-positive"
                viewBox="0 -5 10 10"
                refX="20"
                refY="0"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,-5L10,0L0,5" fill="#00F2FF" opacity="0.5" />
              </marker>
              <marker
                id="arrow-negative"
                viewBox="0 -5 10 10"
                refX="20"
                refY="0"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,-5L10,0L0,5" fill="#DE0541" opacity="0.5" />
              </marker>
            </defs>
            
            {/* Links */}
            {links.map((link, i) => {
              const coords = getLinkCoords(link)
              if (!coords) return null
              const { source, target } = coords
              
              const isHighlighted = hoveredNode && (
                (typeof link.source === 'string' ? link.source : link.source.id) === hoveredNode ||
                (typeof link.target === 'string' ? link.target : link.target.id) === hoveredNode
              )
              
              return (
                <g key={i}>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={link.type === 'positive' ? '#00F2FF' : '#DE0541'}
                    strokeWidth={Math.abs(link.value) * 3}
                    opacity={hoveredNode ? (isHighlighted ? 1 : 0.1) : 0.3}
                    markerEnd={`url(#arrow-${link.type})`}
                    className="transition-opacity duration-300"
                  />
                  {/* Animated flow particles */}
                  {isSimulating && (
                    <circle r="2" fill={link.type === 'positive' ? '#00F2FF' : '#DE0541'}>
                      <animateMotion
                        dur={`${2 + Math.random()}s`}
                        repeatCount="indefinite"
                        path={`M${source.x},${source.y} L${target.x},${target.y}`}
                      />
                    </circle>
                  )}
                </g>
              )
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const isHovered = hoveredNode === node.id
              const isConnected = connectedNodes.has(node.id)
              const isDimmed = hoveredNode && !isHovered && !isConnected
              const size = getNodeSize(node.marketCap)
              
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x || 0}, ${node.y || 0})`}
                  onMouseDown={(e) => handleNodeDrag(e, node)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(node)}
                  className="cursor-pointer"
                  style={{ opacity: isDimmed ? 0.3 : 1 }}
                >
                  {/* Pulse effect for high flow nodes */}
                  {Math.abs(node.flow) > 30 && (
                    <circle
                      r={size + 5}
                      fill="none"
                      stroke={getNodeColor(node.flow)}
                      strokeWidth={1}
                      opacity={0.3}
                      className="animate-ping"
                      style={{ animationDuration: '2s' }}
                    />
                  )}
                  
                  {/* Main node circle */}
                  <circle
                    r={size}
                    fill="#272A31"
                    stroke={getNodeColor(node.flow)}
                    strokeWidth={isHovered ? 3 : 2}
                    className="transition-all duration-200"
                    style={{
                      filter: isHovered ? 'drop-shadow(0 0 8px rgba(0, 242, 255, 0.5))' : 'none'
                    }}
                  />
                  
                  {/* Node label */}
                  <text
                    y={-size - 8}
                    textAnchor="middle"
                    fill="#E1E2EB"
                    fontSize="10"
                    fontFamily="JetBrains Mono"
                    fontWeight={isHovered ? 'bold' : 'normal'}
                    className="pointer-events-none select-none"
                  >
                    {node.name}
                  </text>
                  
                  {/* Flow value */}
                  <text
                    y={4}
                    textAnchor="middle"
                    fill={getNodeColor(node.flow)}
                    fontSize="9"
                    fontFamily="JetBrains Mono"
                    fontWeight="bold"
                    className="pointer-events-none select-none"
                  >
                    {node.flow > 0 ? '+' : ''}{node.flow}B
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 glass-panel p-4 rounded-lg border border-fluid-outline-variant/20">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-fluid-primary" />
              <span className="text-[10px] font-mono-data text-fluid-text-dim">Positive Correlation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-fluid-secondary" />
              <span className="text-[10px] font-mono-data text-fluid-text-dim">Negative Correlation</span>
            </div>
            <div className="h-px bg-fluid-outline-variant/20 my-1" />
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[12px] text-fluid-primary">moving</span>
              <span className="text-[10px] font-mono-data text-fluid-text-dim">Capital Flow</span>
            </div>
          </div>
        </div>

        {/* Selected Node Info */}
        {selectedNode && (
          <div className="absolute bottom-4 right-4 glass-panel p-4 rounded-lg max-w-xs border border-fluid-outline-variant/20">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-headline font-bold text-fluid-text">{selectedNode.name}</h4>
              <button 
                onClick={() => setSelectedNode(null)}
                className="text-fluid-text-dim hover:text-fluid-text"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="space-y-2 text-xs font-mono-data">
              <div className="flex justify-between">
                <span className="text-fluid-text-muted">Market Cap:</span>
                <span className="text-fluid-text">{selectedNode.marketCap}亿</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fluid-text-muted">Flow:</span>
                <span className={selectedNode.flow > 0 ? 'text-fluid-primary' : 'text-fluid-secondary'}>
                  {selectedNode.flow > 0 ? '+' : ''}{selectedNode.flow}亿
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-fluid-text-muted">Change:</span>
                <span className={selectedNode.change > 0 ? 'text-fluid-primary' : 'text-fluid-secondary'}>
                  {selectedNode.change > 0 ? '+' : ''}{selectedNode.change}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-fluid-text-muted">Group:</span>
                <span className="text-fluid-text">{selectedNode.group}</span>
              </div>
            </div>
            <button 
              className="w-full mt-3 py-2 bg-fluid-surface-high rounded text-xs text-fluid-primary hover:bg-fluid-surface-container transition-colors flex items-center justify-center gap-1"
              onClick={() => {
                // Navigate to sector detail
                console.log('View sector detail:', selectedNode.name)
              }}
            >
              View Network Depth
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        )}

        {/* Hover Tooltip */}
        {hoveredNode && !selectedNode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-panel px-4 py-2 rounded-lg border border-fluid-outline-variant/20 pointer-events-none">
            <span className="text-xs text-fluid-text-muted">
              Click to select • Drag to move • Double-click to pin
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
