import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { marketApi, type MarketIndex, type SymbolInfo } from '@/api/market'
import { useToast } from '@/hooks/useToast'
import MoneyFlowRiver from '@/components/MoneyFlowRiver'
import FundGameMatrix from '@/components/FundGameMatrix'
import FundDivergenceAlert from '@/components/FundDivergenceAlert'
import SentimentRadar from '@/components/SentimentRadar'
import SectorNetworkGraph from '@/components/SectorNetworkGraph'

// 
function IndexCard({ index, loading }: { index: MarketIndex; loading: boolean }) {
  // ， null/undefined
  const price = index.price ?? 0
  const change = index.change ?? 0
  const changePercent = index.changePercent ?? 0
  
  const isUp = change >= 0
  const colorClass = isUp ? 'text-stock-up' : 'text-stock-down'
  const bgClass = isUp ? 'bg-stock-up/10' : 'bg-stock-down/10'

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{index.name}</span>
        <span className={`text-xs px-2 py-1 rounded ${bgClass} ${colorClass}`}>
          {index.symbol}
        </span>
      </div>
      {loading ? (
        <div className="animate-pulse">
          <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {price > 0 ? price.toFixed(2) : '--'}
          </div>
          <div className={`flex items-center gap-1 text-sm ${colorClass}`}>
            <span>{isUp ? '+' : ''}{change.toFixed(2)}</span>
            <span>({isUp ? '+' : ''}{changePercent.toFixed(2)}%)</span>
          </div>
        </>
      )}
    </div>
  )
}

export default function Market() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [indices, setIndices] = useState<MarketIndex[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<SymbolInfo[]>([])
  const [searching, setSearching] = useState(false)

  // 
  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      const indicesRes = await marketApi.getMarketIndices()

      setIndices(indicesRes || [])
    } catch {
      showToast('加载市场数据失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // 
  const handleSearch = useCallback(
    async (keyword: string) => {
      if (!keyword.trim()) {
        setSearchResults([])
        return
      }

      try {
        setSearching(true)
        const results = await marketApi.searchSymbols(keyword, 1, 10)
        setSearchResults(results || [])
      } catch {
        showToast('搜索失败', 'error')
      } finally {
        setSearching(false)
      }
    },
    [showToast]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  // 
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchKeyword) {
        handleSearch(searchKeyword)
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchKeyword, handleSearch])

  return (
    <div className="space-y-6">
      {/*  */}
      <div className="relative">
        <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="搜索股票代码或名称..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="flex-1 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
          />
          {searching && (
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>

        {/*  */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-80 overflow-y-auto">
            {searchResults.map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => navigate(`/kline?symbol=${stock.symbol}&market=${stock.market}&name=${encodeURIComponent(stock.name)}`)}
                className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{stock.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {stock.symbol} · {stock.market}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {stock.price != null ? stock.price.toFixed(2) : '--'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/*  */}
        {searchResults.length > 0 && (
          <div className="fixed inset-0 z-40" onClick={() => setSearchResults([])}></div>
        )}
      </div>

      {/*  */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">市场指数</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading && indices.length === 0
            ? // 
              [...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 animate-pulse"
                >
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-4"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                </div>
              ))
            : indices.map((index) => <IndexCard key={index.symbol} index={index} loading={loading} />)}
        </div>
      </section>

      {/* 资金河流图 - 原型演示 */}
      <section className="bg-[#10131A] p-6 rounded-xl border border-[#272A31]">
        <MoneyFlowRiver width={900} height={380} />
      </section>

      {/* 板块资金博弈矩阵 - 原型演示 */}
      <FundGameMatrix />

      {/* 资金背离预警系统 - 原型演示 */}
      <section className="bg-[#10131A] p-6 rounded-xl border border-[#272A31]">
        <FundDivergenceAlert />
      </section>

      {/* 六维市场情绪雷达 - 原型演示 */}
      <section className="bg-[#10131A] p-6 rounded-xl border border-[#272A31]">
        <SentimentRadar />
      </section>

      {/* 板块关联网络图谱 - 原型演示 */}
      <section className="bg-[#10131A] p-6 rounded-xl border border-[#272A31]">
        <SectorNetworkGraph />
      </section>
    </div>
  )
}
