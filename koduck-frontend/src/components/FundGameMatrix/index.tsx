import { useState } from 'react'
import { AccountBalance, Group, SouthEast, CrisisAlert, ViewQuilt } from '@mui/icons-material'

// 数据接口
interface FundFlowData {
  mainCapital: { value: number; change: number }
  retailCapital: { value: number; change: number }
  northbound: { value: number; change: number }
  gameIndex: number
  accumulationPhase: number
}

interface AlertItem {
  id: string
  type: 'golden_pit' | 'negative_divergence' | 'sideways_absorption'
  title: string
  time: string
  description: string
  hasAction?: boolean
}

// 模拟数据
const mockData: FundFlowData = {
  mainCapital: { value: 4.2, change: 12 },
  retailCapital: { value: 1.1, change: -4 },
  northbound: { value: 2.8, change: 8 },
  gameIndex: 88.4,
  accumulationPhase: 92,
}

const mockAlerts: AlertItem[] = [
  {
    id: '1',
    type: 'golden_pit',
    title: '💎 黄金坑预警',
    time: '14:22:05',
    description: '价格下跌 3.2%，但机构资金流入激增 18%，关注抄底机会。',
    hasAction: true,
  },
  {
    id: '2',
    type: 'negative_divergence',
    title: '🔴 顶背离信号',
    time: '13:58:12',
    description: '价格创 24 小时新高，但成交量下降，散户情绪衰竭信号。',
  },
  {
    id: '3',
    type: 'sideways_absorption',
    title: '🔵 横盘吸筹',
    time: '12:15:44',
    description: '价格横盘整理期间，资金流向呈现 V 型复苏。',
  },
]

// 资金行组件
const CapitalRow = ({
  icon: Icon,
  iconColor,
  label,
  value,
  change,
  barColor,
  barWidth,
}: {
  icon: React.ElementType
  iconColor: string
  label: string
  value: number
  change: number
  barColor: string
  barWidth: number
}) => {
  const isPositive = change >= 0

  return (
    <>
      {/* 图标和名称 */}
      <div className="bg-[#191C22] p-4 rounded-l-lg flex items-center gap-4">
        <Icon className="text-xl" style={{ color: iconColor }} />
        <span className="font-body text-sm font-medium text-[#E1E2EB]">{label}</span>
      </div>

      {/* 流入金额 */}
      <div className="bg-[#1D2026] p-4 flex items-center justify-center">
        <span className="font-label text-[#E1E2EB]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {value.toFixed(1)}B{' '}
          <span
            className="text-[10px] opacity-60"
            style={{ color: isPositive ? iconColor : '#FFB3B5' }}
          >
            {isPositive ? '▲' : '▼'} {Math.abs(change)}%
          </span>
        </span>
      </div>

      {/* 影响力条 */}
      <div className="bg-[#1D2026] p-4 rounded-r-lg flex items-center justify-center">
        <div className="w-full bg-[#32353C] h-2 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${barWidth}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
      </div>
    </>
  )
}

// 预警项组件
const AlertItemCard = ({ alert }: { alert: AlertItem }) => {
  const getBorderColor = () => {
    switch (alert.type) {
      case 'golden_pit':
        return '#FFD81D'
      case 'negative_divergence':
        return '#DE0541'
      case 'sideways_absorption':
        return '#00F2FF'
      default:
        return '#3A494B'
    }
  }

  const getTitleColor = () => {
    switch (alert.type) {
      case 'golden_pit':
        return '#FFD81D'
      case 'negative_divergence':
        return '#FFB3B5'
      case 'sideways_absorption':
        return '#00F2FF'
      default:
        return '#E1E2EB'
    }
  }

  return (
    <div
      className="bg-[#191C22] p-4 rounded-lg transition-all hover:bg-[#1D2026]"
      style={{
        borderLeft: `4px solid ${getBorderColor()}`,
        boxShadow: alert.type === 'golden_pit' ? '0 0 15px rgba(255, 216, 29, 0.2)' : 'none',
      }}
    >
      <div className="flex justify-between items-start mb-1">
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{
            color: getTitleColor(),
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {alert.title}
        </span>
        <span
          className="text-[10px] text-[#849495]"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {alert.time}
        </span>
      </div>
      <p className="text-sm text-[#E1E2EB] leading-tight font-body">{alert.description}</p>
      {alert.hasAction && (
        <div className="mt-3 flex gap-2">
          <button className="text-[10px] uppercase px-2 py-1 bg-[#FFD81D] text-[#221B00] font-bold rounded font-label">
            买入信号
          </button>
          <button className="text-[10px] uppercase px-2 py-1 bg-[#272A31] text-[#849495] rounded font-label">
            详情
          </button>
        </div>
      )}
    </div>
  )
}

// 背离图表组件
const DivergenceChart = () => {
  return (
    <div className="col-span-12 bg-[#10131A] p-8 rounded-xl border-t border-white/5">
      {/* 头部 */}
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
        <div>
          <h2
            className="text-xl font-semibold text-[#E1E2EB]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            价格与资金流向背离分析
          </h2>
          <p className="text-xs text-[#849495] font-body mt-1">
            价格走势背后的流动性压力可视化
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#00F2FF]"></span>
            <span
              className="text-[10px] uppercase text-[#849495]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              净流入资金
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#3A494B]"></span>
            <span
              className="text-[10px] uppercase text-[#849495]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              价格基准线
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#FFD81D] animate-pulse"></span>
            <span
              className="text-[10px] uppercase text-[#FFD81D] font-bold"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              黄金坑区域
            </span>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="h-[300px] w-full relative bg-[#0B0E14] rounded-lg border border-[#3A494B]/20 overflow-hidden">
        {/* 网格背景 */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(to right, #3A494B 1px, transparent 1px),
              linear-gradient(to bottom, #3A494B 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* SVG 图表 */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {/* 价格线（灰色） */}
          <path
            d="M0 150 L50 140 L100 160 L150 145 L200 170 L250 185 L300 190 L350 180 L400 200 L450 210 L500 205 L550 215 L600 220 L650 210 L700 215 L750 200 L800 190 L850 195 L900 205"
            fill="none"
            stroke="#3A494B"
            strokeWidth="2"
          />
          {/* 资金流线（青色） */}
          <path
            d="M0 160 L50 155 L100 140 L150 120 L200 110 L250 95 L300 85 L350 70 L400 80 L450 65 L500 75 L550 90 L600 100 L650 95 L700 85 L750 70 L800 60 L850 55 L900 45"
            fill="none"
            stroke="#00F2FF"
            strokeWidth="3"
          />
          {/* Golden Pit 区域 */}
          <rect x="200" y="0" width="150" height="300" fill="url(#goldenPitGrad)" />
          <defs>
            <linearGradient id="goldenPitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFD81D" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#FFD81D" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* 标签 */}
        <div className="absolute top-[170px] left-[220px] bg-[#FFD81D] text-[#221B00] px-2 py-1 text-[10px] font-bold rounded shadow-lg font-label">
          背离信号
        </div>
      </div>

      {/* 底部指标卡片 */}
      <div className="mt-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] bg-[#191C22] p-4 rounded-lg">
          <div
            className="text-[10px] text-[#849495] uppercase mb-1"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            流入速度
          </div>
          <div
            className="text-xl text-[#00F2FF]"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            1.42 BTC/秒
          </div>
        </div>
        <div className="flex-1 min-w-[200px] bg-[#191C22] p-4 rounded-lg">
          <div
            className="text-[10px] text-[#849495] uppercase mb-1"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            流动性缺口
          </div>
          <div
            className="text-xl text-[#FFB3B5]"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            $14.2M 缺口
          </div>
        </div>
        <div className="flex-1 min-w-[200px] bg-[#191C22] p-4 rounded-lg">
          <div
            className="text-[10px] text-[#849495] uppercase mb-1"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            情绪背离
          </div>
          <div
            className="text-xl text-[#FFD81D]"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            -22.5% 偏离
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FundGameMatrix() {
  const [data] = useState<FundFlowData>(mockData)
  const [alerts] = useState<AlertItem[]>(mockAlerts)

  // 计算影响力百分比
  const mainInfluence = Math.min(100, (data.mainCapital.value / 5) * 100)
  const retailInfluence = Math.min(100, (data.retailCapital.value / 5) * 100)
  const northboundInfluence = Math.min(100, (data.northbound.value / 5) * 100)

  return (
    <div className="w-full space-y-6">
      {/* 标题区域 */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1
            className="text-3xl md:text-4xl font-bold tracking-tight text-[#E1E2EB]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            资金博弈 & <span className="text-[#00DBE7]">背离分析</span>
          </h1>
          <p className="text-[#849495] font-body mt-2">
            监控机构建仓周期与散户流动性衰竭信号
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-[#191C22] px-4 py-2 rounded-lg flex flex-col border-l-2 border-[#00F2FF]">
            <span
              className="text-[10px] uppercase text-[#849495]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              市场热度
            </span>
            <span
              className="text-xl text-[#00DBE7]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              74.8%
            </span>
          </div>
          <div className="bg-[#191C22] px-4 py-2 rounded-lg flex flex-col border-l-2 border-[#FFD81D]">
            <span
              className="text-[10px] uppercase text-[#849495]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              背离指数
            </span>
            <span
              className="text-xl text-[#FFD81D]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              危险
            </span>
          </div>
        </div>
      </div>

      {/* Bento Grid 布局 */}
      <div className="grid grid-cols-12 gap-6">
        {/* Capital Game Matrix - 8列 */}
        <section className="col-span-12 lg:col-span-8 bg-[#10131A] p-6 rounded-xl border-t border-white/5 relative overflow-hidden">
          {/* 头部 */}
          <div className="flex justify-between items-center mb-8">
            <h2
              className="text-xl font-semibold flex items-center gap-2 text-[#E1E2EB]"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              <ViewQuilt className="text-[#E1FDFF]" />
              板块资金博弈矩阵
            </h2>
            <span
              className="bg-[#272A31] px-2 py-1 rounded text-[10px] uppercase"
              style={{ color: '#849495', fontFamily: 'JetBrains Mono, monospace' }}
            >
              实时数据
            </span>
          </div>

          {/* 3x3 网格 */}
          <div className="grid grid-cols-3 gap-1">
            {/* 表头 */}
            <div className="col-span-1"></div>
            <div
              className="text-center pb-4 text-[10px] uppercase tracking-widest text-[#849495]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              流入金额
            </div>
            <div
              className="text-center pb-4 text-[10px] uppercase tracking-widest text-[#849495]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              影响力
            </div>

            {/* Main Capital 行 */}
            <CapitalRow
              icon={AccountBalance}
              iconColor="#00F2FF"
              label="主力资金"
              value={data.mainCapital.value}
              change={data.mainCapital.change}
              barColor="#00F2FF"
              barWidth={mainInfluence}
            />

            {/* Retail Capital 行 */}
            <CapitalRow
              icon={Group}
              iconColor="#FFB3B5"
              label="散户资金"
              value={data.retailCapital.value}
              change={data.retailCapital.change}
              barColor="#FFB3B5"
              barWidth={retailInfluence}
            />

            {/* Northbound 行 */}
            <CapitalRow
              icon={SouthEast}
              iconColor="#FFD81D"
              label="北向资金"
              value={data.northbound.value}
              change={data.northbound.change}
              barColor="#FFD81D"
              barWidth={northboundInfluence}
            />
          </div>

          {/* 底部两个卡片 */}
          <div className="mt-8 grid grid-cols-2 gap-4">
            {/* Game Index Calculation */}
            <div className="bg-[#0B0E14] p-6 rounded-lg border border-[#3A494B]/20">
              <div
                className="text-[10px] uppercase text-[#849495] mb-2"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                博弈指数
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-3xl font-bold text-[#E1E2EB]"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  {data.gameIndex.toFixed(1)}
                </span>
                <span
                  className="text-xs text-[#00DBE7]"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  高度控盘
                </span>
              </div>
              <div className="text-xs text-[#849495] mt-2 font-body italic">
                主力资金正在积极吸收流动性，而散户情绪依然悲观。
              </div>
            </div>

            {/* Accumulation Phase */}
            <div className="bg-[#0B0E14] p-6 rounded-lg border border-[#3A494B]/20 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-body font-medium text-[#E1E2EB]">吸筹阶段</span>
                <span
                  className="text-xs text-[#00F2FF]"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {data.accumulationPhase}% 完成
                </span>
              </div>
              <div className="w-full h-4 bg-[#32353C] rounded-sm relative overflow-hidden">
                <div
                  className="absolute inset-0 bg-gradient-to-r from-[#00F2FF]/20 to-[#00F2FF] transition-all duration-500"
                  style={{ width: `${data.accumulationPhase}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Divergence Alerts - 4列 */}
        <section className="col-span-12 lg:col-span-4 bg-[#10131A] p-6 rounded-xl flex flex-col h-full border-t border-white/5">
          <h2
            className="text-xl font-semibold mb-6 flex items-center gap-2 text-[#E1E2EB]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            <CrisisAlert className="text-[#FFD81D]" />
            背离预警
          </h2>
          <div className="space-y-4 flex-1 overflow-y-auto">
            {alerts.map((alert) => (
              <AlertItemCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>

        {/* Divergence Chart - 12列 */}
        <DivergenceChart />
      </div>
    </div>
  )
}
