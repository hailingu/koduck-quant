import { useEffect, useState, useCallback, useMemo } from 'react'
import { portfolioApi, type PortfolioItem, type PortfolioSummary, type TradeRecord, type SectorDistribution } from '@/api/portfolio'
import { useToast } from '@/hooks/useToast'

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

// PnL Chart Component
function PnLChart({ 
  summary, 
  loading 
}: { 
  summary: PortfolioSummary | null
  loading: boolean 
}) {
  if (loading) {
    return (
      <div className="glass-panel p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-mono-data text-fluid-text-muted uppercase mb-1">Daily PNL (盈亏)</div>
            <div className="h-8 w-32 bg-fluid-surface-higher rounded animate-pulse" />
          </div>
        </div>
        <div className="h-40 bg-fluid-surface-higher/50 rounded animate-pulse" />
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="glass-panel p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-mono-data text-fluid-text-muted uppercase mb-1">Daily PNL (盈亏)</div>
            <div className="text-3xl font-headline font-bold text-fluid-text-dim">--</div>
          </div>
        </div>
        <div className="h-40 flex items-center justify-center text-fluid-text-dim text-sm">
          No data available
        </div>
      </div>
    )
  }

  const isPositive = summary.dailyPnl >= 0
  const pnlColor = isPositive ? 'text-fluid-primary' : 'text-fluid-secondary'
  const bgColor = isPositive ? 'bg-fluid-primary/10' : 'bg-fluid-secondary/10'

  return (
    <div className="glass-panel p-5 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] font-mono-data text-fluid-text-muted uppercase mb-1">Daily PNL (盈亏)</div>
          <div className="flex items-baseline gap-3">
            <span className={`text-3xl font-headline font-bold ${pnlColor}`}>
              {isPositive ? '+' : ''}{formatCurrency(summary.dailyPnl)}
            </span>
            <span className={`px-2 py-0.5 ${bgColor} ${pnlColor} text-xs font-mono-data rounded`}>
              {isPositive ? '+' : ''}{formatNumber(summary.dailyPnlPercent)}%
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {['1D', '1W', '1M'].map((period) => (
            <button 
              key={period}
              className={`px-3 py-1 rounded text-xs font-mono-data ${
                period === '1D' 
                  ? 'bg-fluid-primary/20 text-fluid-primary' 
                  : 'text-fluid-text-muted hover:text-fluid-text'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
      
      {/* Line Chart Placeholder */}
      <div className="h-40 relative">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 100">
          <defs>
            <linearGradient id="pnlGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isPositive ? '#00F2FF' : '#DE0541'} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isPositive ? '#00F2FF' : '#DE0541'} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path 
            d="M0 80 Q50 70 100 60 T200 40 T300 50 T400 30 L400 100 L0 100 Z" 
            fill="url(#pnlGrad)"
          />
          <path 
            d="M0 80 Q50 70 100 60 T200 40 T300 50 T400 30" 
            fill="none" 
            stroke={isPositive ? '#00F2FF' : '#DE0541'}
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  )
}

// Sector Allocation Component
function SectorAllocation({ 
  sectors, 
  loading 
}: { 
  sectors: SectorDistribution[]
  loading: boolean 
}) {
  if (loading) {
    return (
      <div className="glass-panel p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline font-bold text-sm text-fluid-text uppercase tracking-wide">Sector Allocation</h3>
        </div>
        <div className="py-12 text-center">
          <div className="w-32 h-32 mx-auto rounded-full bg-fluid-surface-higher animate-pulse" />
        </div>
      </div>
    )
  }

  if (sectors.length === 0) {
    return (
      <div className="glass-panel p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline font-bold text-sm text-fluid-text uppercase tracking-wide">Sector Allocation</h3>
        </div>
        <div className="py-12 text-center text-fluid-text-dim">
          <span className="material-symbols-outlined text-4xl mb-2">donut_large</span>
          <p className="text-sm">No sector data</p>
          <p className="text-xs mt-1">Add positions to see allocation</p>
        </div>
      </div>
    )
  }

  const totalAssets = sectors.length
  const colors = ['bg-fluid-primary', 'bg-fluid-secondary', 'bg-fluid-tertiary', 'bg-fluid-text-dim']
  
  // Calculate stroke dasharray for donut chart
  const circumference = 2 * Math.PI * 40
  let currentOffset = 0
  const chartData = sectors.slice(0, 4).map((s, i) => {
    const dashArray = (s.percent / 100) * circumference
    const data = {
      ...s,
      color: colors[i % colors.length],
      dashArray: `${dashArray} ${circumference}`,
      offset: -currentOffset
    }
    currentOffset += dashArray
    return data
  })

  return (
    <div className="glass-panel p-5 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-sm text-fluid-text uppercase tracking-wide">Sector Allocation</h3>
      </div>
      
      {/* Donut Chart */}
      <div className="relative w-32 h-32 mx-auto mb-4">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#1D2026" strokeWidth="12" />
          {chartData.map((s, i) => (
            <circle 
              key={i}
              cx="50" 
              cy="50" 
              r="40" 
              fill="none" 
              stroke={i === 0 ? '#00F2FF' : i === 1 ? '#DE0541' : i === 2 ? '#FFD81D' : '#849495'}
              strokeWidth="12" 
              strokeDasharray={s.dashArray}
              strokeDashoffset={s.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-fluid-text">{totalAssets} Assets</span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {sectors.slice(0, 4).map((s, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${colors[i % colors.length]}`} />
              <span className="text-fluid-text font-mono-data">{s.sector}</span>
            </div>
            <span className="text-fluid-text-muted">{formatNumber(s.percent)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
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
            Open Positions
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
            Open Positions
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
            Open Positions
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
function RecentEvents({ 
  trades, 
  loading 
}: { 
  trades: TradeRecord[]
  loading: boolean 
}) {
  if (loading) {
    return (
      <div className="glass-panel p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline font-bold text-sm text-fluid-text uppercase tracking-wide">Recent Trades</h3>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="w-10 h-10 rounded-lg bg-fluid-surface-higher animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-fluid-surface-higher rounded animate-pulse" />
                <div className="h-3 w-20 bg-fluid-surface-higher rounded animate-pulse mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="glass-panel p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline font-bold text-sm text-fluid-text uppercase tracking-wide">Recent Trades</h3>
        </div>
        <div className="py-8 text-center text-fluid-text-dim">
          <span className="material-symbols-outlined text-3xl mb-2">receipt_long</span>
          <p className="text-sm">No recent trades</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-panel p-5 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-sm text-fluid-text uppercase tracking-wide">Recent Trades</h3>
        <button className="text-xs text-fluid-primary hover:text-fluid-primary/80 transition-colors">VIEW ALL</button>
      </div>

      <div className="space-y-3">
        {trades.slice(0, 5).map((trade) => {
          const isBuy = trade.type === 'BUY'
          const icon = isBuy ? 'trending_up' : 'trending_down'
          const iconBg = isBuy ? 'bg-fluid-primary/20' : 'bg-fluid-secondary/20'
          const iconColor = isBuy ? 'text-fluid-primary' : 'text-fluid-secondary'
          const valuePrefix = isBuy ? '+' : '-'
          
          return (
            <div key={trade.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
                  <span className={`material-symbols-outlined ${iconColor}`}>{icon}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-fluid-text">
                    {isBuy ? 'Buy' : 'Sell'} {trade.name}
                  </div>
                  <div className="text-xs text-fluid-text-dim">
                    {new Date(trade.tradeTime).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono-data text-fluid-text">
                  {valuePrefix}{formatNumber(trade.quantity)} {trade.symbol}
                </div>
                <div className="text-[10px] text-fluid-text-muted">
                  @ {formatCurrency(trade.price)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Portfolio() {
  const { showToast } = useToast()
  
  // Data states
  const [positions, setPositions] = useState<PortfolioItem[]>([])
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [trades, setTrades] = useState<TradeRecord[]>([])
  const [sectors, setSectors] = useState<SectorDistribution[]>([])
  
  // Loading states
  const [loadingPositions, setLoadingPositions] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingTrades, setLoadingTrades] = useState(true)
  
  // Error states
  const [errorPositions, setErrorPositions] = useState<string | null>(null)
  const [errorSummary, setErrorSummary] = useState<string | null>(null)
  const [errorTrades, setErrorTrades] = useState<string | null>(null)

  // Fetch all portfolio data
  const fetchPortfolioData = useCallback(async () => {
    // Fetch positions
    try {
      setLoadingPositions(true)
      setErrorPositions(null)
      const positionsData = await portfolioApi.getPortfolio()
      setPositions(positionsData)
      
      // Calculate sector distribution from positions
      if (positionsData.length > 0) {
        const sectorData = await portfolioApi.getSectorDistribution(positionsData)
        setSectors(sectorData)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load positions'
      setErrorPositions(errorMessage)
      showToast('Failed to load portfolio positions', 'error')
    } finally {
      setLoadingPositions(false)
    }
    
    // Fetch summary
    try {
      setLoadingSummary(true)
      setErrorSummary(null)
      const summaryData = await portfolioApi.getPortfolioSummary()
      setSummary(summaryData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load summary'
      setErrorSummary(errorMessage)
      showToast('Failed to load portfolio summary', 'error')
    } finally {
      setLoadingSummary(false)
    }
    
    // Fetch trades
    try {
      setLoadingTrades(true)
      setErrorTrades(null)
      const tradesData = await portfolioApi.getTradeRecords()
      setTrades(tradesData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load trades'
      setErrorTrades(errorMessage)
      showToast('Failed to load trade records', 'error')
    } finally {
      setLoadingTrades(false)
    }
  }, [showToast])

  // Initial load
  useEffect(() => {
    void fetchPortfolioData()
  }, [fetchPortfolioData])

  // Derived state
  const totalNetValue = summary?.totalMarketValue ?? 0
  const isPositive = summary?.dailyPnl && summary.dailyPnl >= 0

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
          {loadingSummary ? (
            <div className="h-10 w-40 bg-fluid-surface-higher rounded animate-pulse mt-1" />
          ) : errorSummary ? (
            <div className="text-xl font-headline font-bold text-fluid-secondary">--</div>
          ) : (
            <div className="text-3xl font-headline font-bold text-fluid-text">
              <span className={isPositive ? 'text-fluid-primary' : 'text-fluid-secondary'}>
                {formatCurrency(totalNetValue)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Top Grid */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <PnLChart summary={summary} loading={loadingSummary} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <SectorAllocation sectors={sectors} loading={loadingPositions} />
        </div>
      </div>

      {/* Positions Table */}
      <PositionsTable 
        positions={positions} 
        loading={loadingPositions} 
        error={errorPositions} 
      />

      {/* Recent Events */}
      <RecentEvents trades={trades} loading={loadingTrades} />
    </div>
  )
}
