import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { klineApi } from '@/api/kline'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

const MARKET_LABELS: Record<string, { label: string; currency: string }> = {
  'AShare': { label: 'A股', currency: 'CNY' },
  'HK': { label: '港股', currency: 'HKD' },
  'US': { label: '美股', currency: 'USD' },
  'Forex': { label: '外汇', currency: 'USD' },
  'Futures': { label: '期货', currency: 'CNY' },
}

interface HeaderProps {
  title?: string
  subtitle?: string
  tabs?: { key: string; label: string; active?: boolean }[]
  onTabChange?: (key: string) => void
  showSearch?: boolean
}

interface SearchResult {
  symbol: string
  name: string
  market: string
}

const VALID_MARKETS = new Set(['AShare', 'HK', 'US', 'Forex', 'Futures'])

const normalizeSymbol = (symbol: string): string => {
  const digits = symbol.replace(/\D/g, '')
  if (digits.length >= 1 && digits.length <= 6) {
    return digits.padStart(6, '0')
  }
  return symbol.trim().toUpperCase()
}

const deduplicateResults = (items: SearchResult[]): SearchResult[] => {
  const seen = new Set<string>()
  const deduped: SearchResult[] = []

  for (const item of items) {
    const normalized = normalizeSymbol(item.symbol)
    const market = VALID_MARKETS.has(item.market) ? item.market : 'AShare'
    const key = `${market}:${normalized}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push({
      ...item,
      symbol: normalized,
      market,
    })
  }

  return deduped
}

export default function Header({ 
  title = 'The Fluid Ledger', 
  subtitle,
  tabs = [],
  onTabChange,
  showSearch = true 
}: HeaderProps) {
  const { user } = useAuthStore()
  const { sidebarCollapsed } = useThemeStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [searchFocused, setSearchFocused] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const currentMarket = searchParams.get('market') || 'AShare'
  const marketInfo = MARKET_LABELS[currentMarket]
  const searchPlaceholder = useMemo(() => {
    if (location.pathname === '/kline') {
      const currentSymbol = searchParams.get('symbol') || '601012'
      return `搜索并切换股票 (当前 ${currentSymbol})`
    }
    return '搜索股票代码或名称...'
  }, [location.pathname, searchParams])

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    const trimmed = keyword.trim()
    if (trimmed.length < 1) {
      setResults([])
      setShowDropdown(false)
      setLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const data = await klineApi.searchStocks(trimmed, 10)
        if (cancelled) return
        const normalized = deduplicateResults(data ?? [])
        setResults(normalized)
        setShowDropdown(normalized.length > 0)
      } catch (error) {
        if (!cancelled) {
          setResults([])
          setShowDropdown(false)
        }
        console.error('Header stock search failed:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [keyword])

  const goToKline = (symbol: string, market?: string, name?: string) => {
    const params = new URLSearchParams()
    params.set('symbol', normalizeSymbol(symbol))

    const targetMarket =
      market && VALID_MARKETS.has(market) ? market : (searchParams.get('market') || 'AShare')
    params.set('market', targetMarket)

    if (name) {
      params.set('name', name)
    }

    navigate(`/kline?${params.toString()}`, { replace: location.pathname === '/kline' })
  }

  const handleSearchSubmit = () => {
    const trimmed = keyword.trim()
    if (!trimmed) return
    goToKline(trimmed)
    setShowDropdown(false)
  }

  const handleSelect = (result: SearchResult) => {
    goToKline(result.symbol, result.market, result.name)
    setKeyword(`${result.name} (${normalizeSymbol(result.symbol)})`)
    setShowDropdown(false)
  }

  return (
    <header className={`fixed top-0 right-0 z-30 h-16 glass-panel border-b-0 rounded-none flex items-center justify-between px-6 transition-all duration-300 ${sidebarCollapsed ? 'left-16' : 'left-64'}`}>
      {/* Left: Title & Tabs */}
      <div className="flex items-center gap-6">
        <div>
          <h1 className="font-headline font-bold text-xl text-fluid-primary">{title}</h1>
          {subtitle && <p className="text-xs text-fluid-text-muted font-mono-data">{subtitle}</p>}
        </div>
        
        {/* Tabs */}
        {tabs.length > 0 && (
          <nav className="hidden md:flex items-center gap-6 ml-2 font-headline tracking-tight text-sm">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange?.(tab.key)}
                className={`leading-none pb-1 transition-colors ${
                  tab.active
                    ? 'text-fluid-primary border-b-2 border-fluid-primary'
                    : 'text-fluid-text-muted/80 hover:text-fluid-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
        
        {/* Market Badge */}
        {marketInfo && (
          <div className="ml-4 flex items-center gap-1.5 px-2.5 py-1 bg-fluid-surface-container rounded-lg">
            <span className="text-xs font-medium text-fluid-primary">{marketInfo.label}</span>
            <span className="text-[10px] text-fluid-text-dim">{marketInfo.currency}</span>
          </div>
        )}
      </div>

      {/* Right: Search & Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        {showSearch && (
          <div ref={containerRef} className={`relative transition-all duration-200 ${searchFocused ? 'w-72' : 'w-56'}`}>
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-fluid-text-dim text-lg">
              search
            </span>
            <input
              type="text"
              value={keyword}
              placeholder={searchPlaceholder}
              className="w-full h-9 pl-10 pr-4 bg-fluid-surface-container-low border border-fluid-outline-variant rounded-lg text-sm text-fluid-text placeholder:text-fluid-text-dim focus:outline-none focus:border-fluid-primary-dim transition-all"
              onChange={(e) => setKeyword(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearchSubmit()
                }
              }}
            />
            {loading && (
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-fluid-text-dim text-base animate-spin">
                progress_activity
              </span>
            )}

            {showDropdown && (
              <div className="absolute top-11 left-0 right-0 z-50 rounded-lg border border-fluid-outline-variant bg-fluid-surface-container shadow-lg overflow-hidden">
                {results.map((result) => (
                  <button
                    key={`${result.market}:${result.symbol}`}
                    onClick={() => handleSelect(result)}
                    className="w-full px-3 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-fluid-outline-variant/40 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block text-sm text-fluid-text truncate">{result.name}</span>
                        <span className="block text-xs text-fluid-text-dim font-mono-data">{normalizeSymbol(result.symbol)}</span>
                      </div>
                      <span className="text-[10px] text-fluid-primary font-medium shrink-0">{result.market}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-lg text-fluid-text-muted hover:text-fluid-text hover:bg-white/5 transition-colors relative">
            <span className="material-symbols-outlined text-xl">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-fluid-secondary rounded-full"></span>
          </button>
          
          <button className="p-2 rounded-lg text-fluid-text-muted hover:text-fluid-text hover:bg-white/5 transition-colors">
            <span className="material-symbols-outlined text-xl">settings</span>
          </button>
          
          {/* User Avatar */}
          <button 
            onClick={() => navigate('/profile')}
            className="ml-2 w-9 h-9 rounded-full bg-gradient-to-br from-fluid-primary/30 to-fluid-primary/10 border border-fluid-primary/30 flex items-center justify-center text-fluid-primary font-medium text-sm hover:border-fluid-primary/50 transition-colors cursor-pointer"
            title="个人中心"
          >
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </button>
        </div>
      </div>
    </header>
  )
}
