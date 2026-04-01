import { useEffect, useRef, useCallback, useState } from 'react'

// 资金流动数据接口
interface FundFlowData {
  sector: string
  mainForce: number // 主力资金（亿元）
  retail: number // 散户资金（亿元）
  northbound: number // 北向资金（亿元）
}

// 粒子类 - 表示资金流
class FlowParticle {
  x: number
  y: number
  speed: number
  size: number
  alpha: number
  layer: 'main' | 'retail' | 'northbound'
  pathIndex: number
  progress: number

  constructor(
    x: number,
    y: number,
    speed: number,
    size: number,
    layer: 'main' | 'retail' | 'northbound',
    pathIndex: number
  ) {
    this.x = x
    this.y = y
    this.speed = speed
    this.size = size
    this.alpha = Math.random() * 0.5 + 0.3
    this.layer = layer
    this.pathIndex = pathIndex
    this.progress = Math.random()
  }

  update(deltaTime: number) {
    this.progress += this.speed * deltaTime * 0.001
    if (this.progress > 1) {
      this.progress = 0
      this.alpha = Math.random() * 0.5 + 0.3
    }
  }
}

// 生成模拟数据
const generateMockData = (): FundFlowData[] => [
  { sector: '科技', mainForce: -67.5, retail: 78.2, northbound: -12.3 },
  { sector: '新能源', mainForce: 45.2, retail: 12.1, northbound: 23.5 },
  { sector: '银行', mainForce: 89.3, retail: -45.2, northbound: 34.1 },
  { sector: '医药', mainForce: -23.1, retail: 34.5, northbound: -8.2 },
  { sector: '消费', mainForce: 56.7, retail: 18.9, northbound: 15.6 },
  { sector: '汽车', mainForce: 34.2, retail: 8.5, northbound: 9.8 },
  { sector: '地产', mainForce: -45.6, retail: -12.3, northbound: -5.4 },
  { sector: '军工', mainForce: 23.4, retail: 5.6, northbound: 7.2 },
]

interface MoneyFlowRiverProps {
  width?: number
  height?: number
}

export default function MoneyFlowRiver({ width = 800, height = 400 }: MoneyFlowRiverProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<FlowParticle[]>([])
  const animationRef = useRef<number | undefined>(undefined)
  const [data] = useState<FundFlowData[]>(generateMockData())
  const [selectedLayer, setSelectedLayer] = useState<'all' | 'main' | 'retail' | 'northbound'>('all')
  const [isPlaying, setIsPlaying] = useState(true)

  // 计算河流宽度 - 基于资金量的对数
  const calculateRiverWidth = (flow: number): number => {
    const maxWidth = 80
    const minWidth = 15
    const absFlow = Math.abs(flow)
    return minWidth + (Math.log10(absFlow + 1) / 3) * (maxWidth - minWidth)
  }

  // 获取颜色 - 根据资金流向
  const getFlowColor = (flow: number, layer: 'main' | 'retail' | 'northbound'): string => {
    if (flow > 0) {
      // 流入 - 青色系
      switch (layer) {
        case 'main':
          return '#00F2FF' // primary_container
        case 'retail':
          return '#74F5FF' // primary_fixed
        case 'northbound':
          return '#00DBE7' // primary_fixed_dim
      }
    } else {
      // 流出 - 红色系
      switch (layer) {
        case 'main':
          return '#DE0541' // secondary_container
        case 'retail':
          return '#FFB3B5' // secondary
        case 'northbound':
          return '#920027' // on_secondary_fixed_variant
      }
    }
  }

  // 初始化粒子
  const initParticles = useCallback(() => {
    const particles: FlowParticle[] = []
    const layerConfigs: Array<{ layer: 'main' | 'retail' | 'northbound'; key: keyof FundFlowData }> = [
      { layer: 'main', key: 'mainForce' },
      { layer: 'retail', key: 'retail' },
      { layer: 'northbound', key: 'northbound' },
    ]

    layerConfigs.forEach(({ layer, key }, layerIdx) => {
      const baseY = height / 2 + (layerIdx - 1) * 100

      data.forEach((item, index) => {
        const flow = item[key] as number
        const particleCount = Math.max(5, Math.min(20, Math.abs(flow) / 2))

        for (let i = 0; i < particleCount; i++) {
          particles.push(
            new FlowParticle(
              Math.random() * width,
              baseY + (Math.random() - 0.5) * calculateRiverWidth(flow),
              Math.abs(flow) / 50,
              Math.random() * 2 + 1,
              layer,
              index
            )
          )
        }
      })
    })

    particlesRef.current = particles
  }, [data, height, width])

  // 绘制河流
  const drawRiver = useCallback(
    (ctx: CanvasRenderingContext2D, deltaTime: number) => {
      // 清空画布
      ctx.fillStyle = '#0B0E14'
      ctx.fillRect(0, 0, width, height)

      // 绘制背景网格
      ctx.strokeStyle = '#1D2026'
      ctx.lineWidth = 1
      for (let i = 0; i < width; i += 40) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, height)
        ctx.stroke()
      }
      for (let i = 0; i < height; i += 40) {
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(width, i)
        ctx.stroke()
      }

      // 绘制河流路径
      const layers: Array<{ layer: 'main' | 'retail' | 'northbound'; key: keyof FundFlowData; label: string }> = [
        { layer: 'main', key: 'mainForce', label: '主力资金' },
        { layer: 'retail', key: 'retail', label: '散户资金' },
        { layer: 'northbound', key: 'northbound', label: '北向资金' },
      ]

      layers.forEach(({ layer, key, label }, layerIdx) => {
        if (selectedLayer !== 'all' && selectedLayer !== layer) return

        const baseY = height / 2 + (layerIdx - 1) * 100

        data.forEach((item, index) => {
          const flow = item[key] as number
          const riverWidth = calculateRiverWidth(flow)
          const color = getFlowColor(flow, layer)
          const x = (index + 0.5) * (width / data.length)

          // 绘制河流段（使用贝塞尔曲线）
          const prevX = index > 0 ? (index - 0.5) * (width / data.length) : x - 80
          const nextX = index < data.length - 1 ? (index + 1.5) * (width / data.length) : x + 80

          // 河流渐变
          const gradient = ctx.createLinearGradient(prevX, 0, nextX, 0)
          gradient.addColorStop(0, color + '40')
          gradient.addColorStop(0.5, color + '80')
          gradient.addColorStop(1, color + '40')

          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.moveTo(prevX, baseY - riverWidth / 2)
          ctx.bezierCurveTo(
            (prevX + x) / 2,
            baseY - riverWidth / 2,
            (prevX + x) / 2,
            baseY - riverWidth / 3,
            x,
            baseY - riverWidth / 3
          )
          ctx.bezierCurveTo(
            (x + nextX) / 2,
            baseY - riverWidth / 3,
            (x + nextX) / 2,
            baseY - riverWidth / 2,
            nextX,
            baseY - riverWidth / 2
          )
          ctx.lineTo(nextX, baseY + riverWidth / 2)
          ctx.bezierCurveTo(
            (x + nextX) / 2,
            baseY + riverWidth / 2,
            (x + nextX) / 2,
            baseY + riverWidth / 3,
            x,
            baseY + riverWidth / 3
          )
          ctx.bezierCurveTo(
            (prevX + x) / 2,
            baseY + riverWidth / 3,
            (prevX + x) / 2,
            baseY + riverWidth / 2,
            prevX,
            baseY + riverWidth / 2
          )
          ctx.closePath()
          ctx.fill()

          // 绘制板块标签
          ctx.fillStyle = '#E1E2EB'
          ctx.font = '12px JetBrains Mono, monospace'
          ctx.textAlign = 'center'
          ctx.fillText(item.sector, x, baseY + riverWidth / 2 + 20)

          // 绘制资金数值
          ctx.fillStyle = color
          ctx.font = 'bold 11px JetBrains Mono, monospace'
          ctx.fillText(`${flow > 0 ? '+' : ''}${flow.toFixed(1)}亿`, x, baseY + riverWidth / 2 + 35)
        })

        // 绘制层标签
        ctx.fillStyle = '#849495'
        ctx.font = '11px Inter, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(label, 10, baseY)
      })

      // 更新和绘制粒子
      particlesRef.current.forEach((particle) => {
        if (selectedLayer !== 'all' && selectedLayer !== particle.layer) return

        particle.update(deltaTime)

        const dataIndex = Math.floor(particle.pathIndex % data.length)
        const item = data[dataIndex]
        const layerIdx = particle.layer === 'main' ? 0 : particle.layer === 'retail' ? 1 : 2
        const baseY = height / 2 + (layerIdx - 1) * 100
        const flow = item[particle.layer === 'main' ? 'mainForce' : particle.layer === 'retail' ? 'retail' : 'northbound']
        const riverWidth = calculateRiverWidth(flow)

        // 计算粒子在河流中的位置
        const x = particle.progress * width
        const yOffset = Math.sin(particle.progress * Math.PI * 4 + particle.pathIndex) * (riverWidth / 4)
        const y = baseY + yOffset

        // 绘制粒子
        ctx.beginPath()
        ctx.arc(x, y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = getFlowColor(flow, particle.layer) + Math.floor(particle.alpha * 255).toString(16).padStart(2, '0')
        ctx.fill()

        // 粒子光晕效果
        const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, particle.size * 3)
        glowGradient.addColorStop(0, getFlowColor(flow, particle.layer) + '60')
        glowGradient.addColorStop(1, getFlowColor(flow, particle.layer) + '00')
        ctx.fillStyle = glowGradient
        ctx.beginPath()
        ctx.arc(x, y, particle.size * 3, 0, Math.PI * 2)
        ctx.fill()
      })
    },
    [data, height, width, selectedLayer]
  )

  // 动画循环
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    initParticles()

    let lastTime = performance.now()

    const animate = (currentTime: number) => {
      if (!isPlaying) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      const deltaTime = currentTime - lastTime
      lastTime = currentTime

      drawRiver(ctx, deltaTime)
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [drawRiver, initParticles, isPlaying])

  return (
    <div className="w-full space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-[#E1E2EB]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            资金河流图
          </h3>
          <p className="text-xs text-[#849495] mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
            Capital as Water - 让资金流向变得可见
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1.5 text-xs font-medium rounded bg-[#1D2026] text-[#E1E2EB] hover:bg-[#272A31] transition-colors border border-[#3A494B]/30"
          >
            {isPlaying ? '⏸ 暂停' : '▶ 播放'}
          </button>
        </div>
      </div>

      {/* 图例和筛选 */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="text-[#849495]">显示层级:</span>
        {[
          { key: 'all', label: '全部', color: '#E1E2EB' },
          { key: 'main', label: '主力资金', color: '#00F2FF' },
          { key: 'retail', label: '散户资金', color: '#74F5FF' },
          { key: 'northbound', label: '北向资金', color: '#00DBE7' },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setSelectedLayer(key as typeof selectedLayer)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all ${
              selectedLayer === key
                ? 'bg-[#272A31] text-[#E1E2EB]'
                : 'text-[#849495] hover:text-[#E1E2EB]'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
            />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Canvas 画布 */}
      <div
        className="relative rounded-lg overflow-hidden border border-[#3A494B]/20"
        style={{ background: '#0B0E14' }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-auto block"
          style={{ maxWidth: '100%' }}
        />

        {/* 装饰性流光效果 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(0, 242, 255, 0.03) 50%, transparent 100%)',
            animation: 'shimmer 3s ease-in-out infinite',
          }}
        />
      </div>

      {/* 说明文字 */}
      <div className="grid grid-cols-3 gap-4 text-xs">
        <div className="p-3 rounded bg-[#191C22] border-l-2 border-[#00F2FF]">
          <div className="text-[#00F2FF] font-medium mb-1">河流宽度</div>
          <div className="text-[#849495]">代表资金流量大小</div>
        </div>
        <div className="p-3 rounded bg-[#191C22] border-l-2 border-[#00F2FF]">
          <div className="text-[#00F2FF] font-medium mb-1">流动方向</div>
          <div className="text-[#849495]">粒子流向表示资金流入/流出</div>
        </div>
        <div className="p-3 rounded bg-[#191C22] border-l-2 border-[#00F2FF]">
          <div className="text-[#00F2FF] font-medium mb-1">颜色深浅</div>
          <div className="text-[#849495]">青色=流入，红色=流出</div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}
