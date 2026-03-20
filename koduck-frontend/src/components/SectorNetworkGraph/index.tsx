import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Hub, Close, ZoomIn, ZoomOut, Refresh, FilterList } from '@mui/icons-material'

// 节点数据
interface SectorNode {
  id: string
  name: string
  marketCap: number // 市值（亿）
  flow: number // 资金流向（亿）
  change: number // 涨跌幅
  group: number // 分组
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

// 连线数据
interface SectorLink {
  source: string | SectorNode
  target: string | SectorNode
  value: number // 关联强度 0-1
  type: 'positive' | 'negative' // 正相关/负相关
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
    // 新能源产业链正相关
    { source: '1', target: '2', value: 0.85, type: 'positive' },
    { source: '1', target: '3', value: 0.78, type: 'positive' },
    { source: '1', target: '4', value: 0.72, type: 'positive' },
    { source: '2', target: '3', value: 0.65, type: 'positive' },
    // 金融板块正相关
    { source: '5', target: '6', value: 0.68, type: 'positive' },
    { source: '5', target: '7', value: 0.55, type: 'positive' },
    // 科技板块正相关
    { source: '8', target: '9', value: 0.82, type: 'positive' },
    { source: '8', target: '10', value: 0.75, type: 'positive' },
    { source: '9', target: '10', value: 0.70, type: 'positive' },
    // 医药板块正相关
    { source: '11', target: '12', value: 0.62, type: 'positive' },
    // 消费板块正相关
    { source: '13', target: '14', value: 0.58, type: 'positive' },
    // 跷跷板效应 - 负相关
    { source: '1', target: '8', value: -0.65, type: 'negative' },
    { source: '1', target: '5', value: -0.45, type: 'negative' },
    { source: '5', target: '8', value: -0.55, type: 'negative' },
    { source: '2', target: '9', value: -0.48, type: 'negative' },
    { source: '13', target: '5', value: -0.35, type: 'negative' },
    { source: '11', target: '1', value: -0.42, type: 'negative' },
    { source: '17', target: '5', value: -0.38, type: 'negative' },
    { source: '17', target: '13', value: -0.52, type: 'negative' },
  ]

  return { nodes, links }
}

// 力导向布局模拟
class ForceSimulation {
  nodes: SectorNode[]
  links: SectorLink[]
  width: number
  height: number
  centerX: number
  centerY: number

  constructor(nodes: SectorNode[], links: SectorLink[], width: number, height: number) {
    this.nodes = nodes.map((n) => ({ ...n, x: undefined, y: undefined, vx: 0, vy: 0 }))
    this.links = links
    this.width = width
    this.height = height
    this.centerX = width / 2
    this.centerY = height / 2

    // 初始化位置
    this.nodes.forEach((node, i) => {
      const angle = (i / this.nodes.length) * Math.PI * 2
      const radius = Math.min(width, height) * 0.3
      node.x = this.centerX + radius * Math.cos(angle)
      node.y = this.centerY + radius * Math.sin(angle)
    })
  }

  tick() {
    const repulsionForce = 8000
    const springLength = 80
    const springStrength = 0.05
    const centerForce = 0.02

    // 斥力
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeA = this.nodes[i]
        const nodeB = this.nodes[j]
        const dx = (nodeB.x || 0) - (nodeA.x || 0)
        const dy = (nodeB.y || 0) - (nodeA.y || 0)
        const distSq = dx * dx + dy * dy
        const dist = Math.sqrt(distSq) || 1

        const force = repulsionForce / (distSq + 100)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        if (!nodeA.fx) {
          nodeA.vx = (nodeA.vx || 0) - fx
          nodeA.vy = (nodeA.vy || 0) - fy
        }
        if (!nodeB.fx) {
          nodeB.vx = (nodeB.vx || 0) + fx
          nodeB.vy = (nodeB.vy || 0) + fy
        }
      }
    }

    // 弹簧力（连线）
    this.links.forEach((link) => {
      const source = typeof link.source === 'string' ? this.nodes.find((n) => n.id === link.source) : link.source
      const target = typeof link.target === 'string' ? this.nodes.find((n) => n.id === link.target) : link.target
      if (!source || !target) return

      const dx = (target.x || 0) - (source.x || 0)
      const dy = (target.y || 0) - (source.y || 0)
      const dist = Math.sqrt(dx * dx + dy * dy) || 1

      const force = (dist - springLength) * springStrength * Math.abs(link.value)
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force

      if (!source.fx) {
        source.vx = (source.vx || 0) + fx
        source.vy = (source.vy || 0) + fy
      }
      if (!target.fx) {
        target.vx = (target.vx || 0) - fx
        target.vy = (target.vy || 0) - fy
      }
    })

    // 中心引力
    this.nodes.forEach((node) => {
      if (!node.fx) {
        node.vx = (node.vx || 0) + (this.centerX - (node.x || 0)) * centerForce
        node.vy = (node.vy || 0) + (this.centerY - (node.y || 0)) * centerForce
      }
    })

    // 更新位置
    this.nodes.forEach((node) => {
      if (!node.fx) {
        node.x = (node.x || 0) + (node.vx || 0) * 0.5
        node.y = (node.y || 0) + (node.vy || 0) * 0.5
      }
      // 边界限制
      const margin = 40
      node.x = Math.max(margin, Math.min(this.width - margin, node.x || 0))
      node.y = Math.max(margin, Math.min(this.height - margin, node.y || 0))
      // 阻尼
      node.vx = (node.vx || 0) * 0.9
      node.vy = (node.vy || 0) * 0.9
    })
  }
}

export default function SectorNetworkGraph() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [data, setData] = useState(generateMockData())
  const [simulation, setSimulation] = useState<ForceSimulation | null>(null)
  const [zoom, setZoom] = useState(1)
  const [selectedNode, setSelectedNode] = useState<SectorNode | null>(null)
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [showPositiveOnly, setShowPositiveOnly] = useState(false)
  const [animationEnabled, setAnimationEnabled] = useState(true)

  const width = 800
  const height = 500

  // 初始化模拟
  useEffect(() => {
    const sim = new ForceSimulation(data.nodes, data.links, width, height)
    setSimulation(sim)
  }, [data, width, height])

  // 动画循环
  useEffect(() => {
    if (!simulation || !animationEnabled) return
    let rafId: number
    const animate = () => {
      for (let i = 0; i < 3; i++) {
        simulation.tick()
      }
      setSimulation({ ...simulation })
      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [simulation, animationEnabled])

  // 获取节点颜色
  const getNodeColor = (flow: number) => {
    if (flow > 10) return '#00F2FF'
    if (flow > 0) return '#00DBE7'
    if (flow > -10) return '#849495'
    return '#FFB3B5'
  }

  // 获取节点大小
  const getNodeSize = (marketCap: number) => {
    return Math.sqrt(marketCap / 100) + 15
  }

  // 处理拖拽
  const handleMouseDown = (nodeId: string) => {
    setDraggingNode(nodeId)
  }

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingNode || !svgRef.current || !simulation) return
      const rect = svgRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left) / zoom
      const y = (e.clientY - rect.top) / zoom

      const node = simulation.nodes.find((n) => n.id === draggingNode)
      if (node) {
        node.fx = x
        node.fy = y
        node.x = x
        node.y = y
        setSimulation({ ...simulation })
      }
    },
    [draggingNode, zoom, simulation]
  )

  const handleMouseUp = () => {
    if (draggingNode && simulation) {
      const node = simulation.nodes.find((n) => n.id === draggingNode)
      if (node) {
        node.fx = null
        node.fy = null
      }
    }
    setDraggingNode(null)
  }

  // 过滤后的连线
  const visibleLinks = useMemo(() => {
    if (!simulation) return []
    return data.links.filter((link) => {
      if (showPositiveOnly && link.type === 'negative') return false
      return true
    })
  }, [data.links, showPositiveOnly, simulation])

  return (
    <div className="w-full space-y-6">
      {/* 标题区域 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight text-[#E1E2EB]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            板块关联 <span className="text-[#00F2FF]">网络图谱</span>
          </h1>
          <p className="text-[#849495] font-body mt-2">力导向图展示板块间资金关联与跷跷板效应</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnimationEnabled(!animationEnabled)}
            className={`p-2 rounded transition-colors ${animationEnabled ? 'bg-[#00F2FF]/20 text-[#00F2FF]' : 'bg-[#272A31] text-[#849495]'}`}
            title={animationEnabled ? '暂停动画' : '开始动画'}
          >
            {animationEnabled ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.2, 3))}
            className="p-2 rounded bg-[#272A31] text-[#849495] hover:bg-[#32353C] transition-colors"
            title="放大"
          >
            <ZoomIn fontSize="small" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z / 1.2, 0.5))}
            className="p-2 rounded bg-[#272A31] text-[#849495] hover:bg-[#32353C] transition-colors"
            title="缩小"
          >
            <ZoomOut fontSize="small" />
          </button>
          <button
            onClick={() => {
              setZoom(1)
              setData(generateMockData())
            }}
            className="p-2 rounded bg-[#272A31] text-[#849495] hover:bg-[#32353C] transition-colors"
            title="重置"
          >
            <Refresh fontSize="small" />
          </button>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="flex flex-wrap gap-3 p-4 bg-[#10131A] rounded-lg border border-[#272A31]">
        <button
          onClick={() => setShowPositiveOnly(!showPositiveOnly)}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors ${
            showPositiveOnly ? 'bg-[#00F2FF]/20 text-[#00F2FF]' : 'bg-[#272A31] text-[#849495]'
          }`}
        >
          <FilterList fontSize="small" />
          {showPositiveOnly ? '仅正相关' : '全部关联'}
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#00F2FF]" />
            <span className="text-xs text-[#849495]">资金流入</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#FFB3B5]" />
            <span className="text-xs text-[#849495]">资金流出</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-0.5 bg-[#00F2FF]" />
            <span className="text-xs text-[#849495]">正相关</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-0.5 bg-[#DE0541]" />
            <span className="text-xs text-[#849495]">负相关(跷跷板)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 网络图 */}
        <div className="lg:col-span-2 bg-[#10131A] rounded-xl border border-[#272A31] overflow-hidden">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center',
              transition: draggingNode ? 'none' : 'transform 0.3s ease',
              cursor: draggingNode ? 'grabbing' : 'default',
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* 网格背景 */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1" fill="#272A31" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* 连线 */}
            {visibleLinks.map((link, i) => {
              const source =
                typeof link.source === 'string'
                  ? simulation?.nodes.find((n) => n.id === link.source)
                  : link.source
              const target =
                typeof link.target === 'string'
                  ? simulation?.nodes.find((n) => n.id === link.target)
                  : link.target
              if (!source || !target) return null

              return (
                <line
                  key={i}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={link.type === 'positive' ? '#00F2FF' : '#DE0541'}
                  strokeWidth={Math.abs(link.value) * 3}
                  strokeOpacity={0.4}
                  strokeDasharray={link.type === 'negative' ? '5,5' : 'none'}
                />
              )
            })}

            {/* 节点 */}
            {simulation?.nodes.map((node) => {
              const size = getNodeSize(node.marketCap)
              const color = getNodeColor(node.flow)
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{ cursor: draggingNode === node.id ? 'grabbing' : 'pointer' }}
                  onMouseDown={() => handleMouseDown(node.id)}
                  onClick={() => setSelectedNode(node)}
                >
                  {/* 发光效果 */}
                  <circle
                    r={size + 5}
                    fill={color}
                    opacity={0.2}
                    className={animationEnabled ? 'animate-pulse' : ''}
                  />
                  {/* 节点主体 */}
                  <circle
                    r={size}
                    fill="#272A31"
                    stroke={color}
                    strokeWidth={selectedNode?.id === node.id ? 3 : 2}
                  />
                  {/* 名称 */}
                  <text
                    y={size + 15}
                    textAnchor="middle"
                    fill="#E1E2EB"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {node.name}
                  </text>
                  {/* 资金流向 */}
                  <text
                    y={5}
                    textAnchor="middle"
                    fill={color}
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {node.flow > 0 ? '+' : ''}
                    {node.flow.toFixed(1)}亿
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* 侧边栏详情 */}
        <div className="space-y-4">
          {selectedNode ? (
            <div className="bg-[#10131A] p-4 rounded-xl border border-[#272A31]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#E1E2EB]">{selectedNode.name}</h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded hover:bg-[#272A31] text-[#849495]"
                >
                  <Close fontSize="small" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-[#0B0E14] rounded">
                  <span className="text-xs text-[#849495]">市值</span>
                  <span className="text-sm text-[#E1E2EB]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {(selectedNode.marketCap / 10000).toFixed(2)}万亿
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-[#0B0E14] rounded">
                  <span className="text-xs text-[#849495]">资金流向</span>
                  <span
                    className="text-sm font-bold"
                    style={{
                      color: getNodeColor(selectedNode.flow),
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {selectedNode.flow > 0 ? '+' : ''}
                    {selectedNode.flow.toFixed(1)}亿
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-[#0B0E14] rounded">
                  <span className="text-xs text-[#849495]">涨跌幅</span>
                  <span
                    className="text-sm font-bold"
                    style={{
                      color: selectedNode.change >= 0 ? '#00F2FF' : '#FFB3B5',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {selectedNode.change >= 0 ? '+' : ''}
                    {selectedNode.change.toFixed(2)}%
                  </span>
                </div>

                {/* 关联板块 */}
                <div className="pt-2">
                  <div className="text-xs text-[#849495] mb-2">关联板块</div>
                  <div className="space-y-2">
                    {data.links
                      .filter(
                        (l) =>
                          (typeof l.source === 'string' ? l.source : l.source.id) === selectedNode.id ||
                          (typeof l.target === 'string' ? l.target : l.target.id) === selectedNode.id
                      )
                      .slice(0, 5)
                      .map((link, i) => {
                        const otherId =
                          (typeof link.source === 'string' ? link.source : link.source.id) === selectedNode.id
                            ? typeof link.target === 'string'
                              ? link.target
                              : link.target.id
                            : typeof link.source === 'string'
                              ? link.source
                              : link.source.id
                        const otherNode = data.nodes.find((n) => n.id === otherId)
                        if (!otherNode) return null
                        return (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-[#E1E2EB]">{otherNode.name}</span>
                            <span style={{ color: link.type === 'positive' ? '#00F2FF' : '#DE0541' }}>
                              {link.type === 'positive' ? '正相关' : '负相关'} {(Math.abs(link.value) * 100).toFixed(0)}%
                            </span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#10131A] p-6 rounded-xl border border-[#272A31] text-center">
              <Hub className="text-4xl text-[#849495] mx-auto mb-2" />
              <p className="text-[#849495]">点击节点查看详情</p>
              <p className="text-xs text-[#849495] mt-1">拖拽节点调整位置</p>
            </div>
          )}

          {/* 统计 */}
          <div className="bg-[#10131A] p-4 rounded-xl border border-[#272A31]">
            <div className="text-sm font-bold text-[#E1E2EB] mb-3">网络统计</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#0B0E14] rounded text-center">
                <div className="text-lg font-bold text-[#00F2FF]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {data.nodes.length}
                </div>
                <div className="text-xs text-[#849495]">板块数</div>
              </div>
              <div className="p-3 bg-[#0B0E14] rounded text-center">
                <div className="text-lg font-bold text-[#FFD81D]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {data.links.filter((l) => l.type === 'negative').length}
                </div>
                <div className="text-xs text-[#849495]">跷跷板</div>
              </div>
              <div className="p-3 bg-[#0B0E14] rounded text-center">
                <div className="text-lg font-bold text-[#00DBE7]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {data.nodes.filter((n) => n.flow > 0).length}
                </div>
                <div className="text-xs text-[#849495]">流入板块</div>
              </div>
              <div className="p-3 bg-[#0B0E14] rounded text-center">
                <div className="text-lg font-bold text-[#FFB3B5]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {data.nodes.filter((n) => n.flow < 0).length}
                </div>
                <div className="text-xs text-[#849495]">流出板块</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
