import { useEffect, useState, useCallback } from 'react'
import { portfolioApi, type PortfolioItem } from '@/api/portfolio'
import { useToast } from '@/hooks/useToast'

// Portfolio Management Page

// PnL Chart Component
function PnLChart() {
  return (
    <div className="glass-panel p-5 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] font-mono-data text-fluid-text-muted uppercase mb-1">Daily PNL (盈亏)</div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-headline font-bold text-fluid-primary">+$12,405.12</span>
            <span className="px-2 py-0.5 bg-fluid-primary/10 text-fluid-primary text-xs font-mono-data rounded">+4.2%</span>
          </div>
        </div>
        <div className="flex gap-2">
          {['1D', '1W', '1M'].map((period) => (
            <button 
              key={period}
              className={`px-3 py-1 rounded text-xs font-mono-data ${
                period === '1W' 
                  ? 'bg-fluid-primary/20 text-fluid-primary' 
                  : 'text-fluid-text-muted hover:text-fluid-text'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
      
      {/* Line Chart */}
      <div className="h-40 relative">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 100">
          <defs>
            <linearGradient id="pnlGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00F2FF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#00F2FF" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path 
            d="M0 80 Q50 70 100 60 T200 40 T300 50 T400 30 L400 100 L0 100 Z" 
            fill="url(#pnlGrad)"
          />
          <path 
            d="M0 80 Q50 70 100 60 T200 40 T300 50 T400 30" 
            fill="none" 
            stroke="#00F2FF" 
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  )
}

// Sector Allocation Component
function SectorAllocation() {
  const sectors = [
    { name: 'DEFI CORE', percent: 45, color: 'bg-fluid-primary' },
    { name: 'L1 INFRA', percent: 32, color: 'bg-fluid-secondary' },
    { name: 'LIQUID STAKING', percent: 23, color: 'bg-fluid-text-dim' },
  ]

  return (
    <div className="glass-panel p-5 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-sm text-fluid-text uppercase tracking-wide">Sector Allocation</h3>
      </div>
      
      {/* Donut Chart Placeholder */}
      <div className="relative w-32 h-32 mx-auto mb-4">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#1D2026" strokeWidth="12" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="#00F2FF" strokeWidth="12" strokeDasharray="113 251" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="#DE0541" strokeWidth="12" strokeDasharray="80 251" strokeDashoffset="-113" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-fluid-text">7 Assets</span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {sectors.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.color}`} />
              <span className="text-fluid-text font-mono-data">{s.name}</span>
            </div>
            <span className="text-fluid-text-muted">{s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Utility function to format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Utility function to format number
function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

// Positions Table Component
function PositionsTable({ 
  positions, 
  loading, 
  error 
}: { 
  positions: PortfolioItem[]
  loading: boolean
  error: string | null 
}) {
  if (loading) {
    return (
      <div className="glass-panel p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline font-bold text-sm text-fluid-text uppercase tracking-wide">
            Open Positions (持仓列表)
          </h3>
        </div>
        <div className="py-12 text-center">
          <div className="inline-flex items-center gap-2 text-fluid-text-dim">
            <div className="w-5 h-5 border-2 border-fluid-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading positions...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-panel p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline font-bold text-sm text-fluid-text uppercase tracking-wide">
            Open Positions (持仓列表)
          </h3>
        </div>
        <div className="py-12 text-center text-fluid-secondary">
          <span className="material-symbols-outlined text-4xl mb-2">error_outline</span>
          <p className="text-sm">Failed to load positions</p>
          <p className="text-xs text-fluid-text-dim mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (positions.length === 0) {
    return (
      <div className="glass-panel p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline font-bold text-sm text-fluid-text uppercase tracking-wide">
            Open Positions (持仓列表)
          </h3>
        </div>
        <div className="py-12 text-center text-fluid-text-dim">
          <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
          <p className="text-sm">No open positions</p>
          <p className="text-xs mt-1">Add your first trade to see holdings</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-panel p-5 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-sm text-fluid-text uppercase tracking-wide">
          Open Positions ({positions.length})
        </h3>
        <span className="material-symbols-outlined text-fluid-text-dim">filter_list</span>
      </div>

      <table className="w-full">
        <thead>
          <tr className="text-[10px] font-mono-data text-fluid-text-muted uppercase tracking-wider border-b border-fluid-outline-variant/30">
            <th className="text-left py-3">Asset</th>
            <th className="text-right py-3">Avg Price</th>
            <th className="text-right py-3">Current Price</th>
            <th className="text-right py-3">PnL %</th>
            <th className="text-right py-3">Market Value</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <tr key={pos.id} className="border-b border-fluid-outline-variant/10 last:border-0 hover:bg-fluid-surface-higher/30 transition-colors">
              <td className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-fluid-surface-container flex items-center justify-center text-[10px] font-mono-data text-fluid-text">
                    {pos.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-fluid-text">{pos.name}</div>
                    <div className="text-xs text-fluid-text-dim">{formatNumber(pos.quantity)} {pos.symbol}</div>
                  </div>
                </div>
              </td>
              <td className="text-right py-4 text-sm text-fluid-text-muted">{formatCurrency(pos.avgCost)}</td>
              <td className="text-right py-4 text-sm text-fluid-text">{formatCurrency(pos.currentPrice)}</td>
              <td className={`text-right py-4 text-sm font-mono-data ${pos.pnlPercent >= 0 ? 'text-fluid-primary' : 'text-fluid-secondary'}`}>
                {pos.pnlPercent >= 0 ? '+' : ''}{formatNumber(pos.pnlPercent)}%
              </td>
              <td className="text-right py-4 text-sm font-medium text-fluid-text">{formatCurrency(pos.marketValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Recent Events Component
function RecentEvents() {
  const events = [
    { icon: 'swap_horiz', iconBg: 'bg-fluid-primary/20', iconColor: 'text-fluid-primary', title: 'Swap ETH for USDC', time: '2024-05-20 14:24:01', value: '-1.42 ETH', status: 'SUCCESS', statusColor: 'text-fluid-primary' },
    { icon: 'trending_up', iconBg: 'bg-fluid-secondary/20', iconColor: 'text-fluid-secondary', title: 'Staking Reward: SOL', time: '2024-05-19 23:11:45', value: '+0.85 SOL', status: 'SETTLED', statusColor: 'text-fluid-tertiary' },
  ]

  return (
    <div className="glass-panel p-5 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-sm text-fluid-text uppercase tracking-wide">Recent Flux Events</h3>
        <button className="text-xs text-fluid-primary hover:text-fluid-primary/80 transition-colors">VIEW ALL LOGS</button>
      </div>

      <div className="space-y-3">
        {events.map((evt, i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${evt.iconBg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${evt.iconColor}`}>{evt.icon}</span>
              </div>
              <div>
                <div className="text-sm font-medium text-fluid-text">{evt.title}</div>
                <div className="text-xs text-fluid-text-dim">{evt.time}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-mono-data text-fluid-text">{evt.value}</div>
              <div className={`text-[10px] ${evt.statusColor}`}>{evt.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Portfolio() {
  const { showToast } = useToast()
  const [positions, setPositions] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch portfolio data
  const fetchPortfolio = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await portfolioApi.getPortfolio()
      setPositions(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load portfolio'
      setError(errorMessage)
      showToast('Failed to load portfolio data', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // Initial load
  useEffect(() => {
    void fetchPortfolio()
  }, [fetchPortfolio])

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold tracking-tight text-fluid-primary">
            Portfolio Management
          </h1>
          <p className="text-fluid-text-muted mt-1 font-mono-data text-xs uppercase tracking-wider">
            System Status: Active | Global Liquidity: High
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono-data text-fluid-text-muted uppercase">Total Net Value</div>
          <div className="text-3xl font-headline font-bold text-fluid-text">
            <span className="text-fluid-primary">$</span>2,841,902<span className="text-lg text-fluid-text-muted">.45</span>
          </div>
        </div>
      </div>

      {/* Top Grid */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <PnLChart />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <SectorAllocation />
        </div>
      </div>

      {/* Positions Table */}
      <PositionsTable 
        positions={positions} 
        loading={loading} 
        error={error} 
      />

      {/* Recent Events */}
      <RecentEvents />
    </div>
  )
}
