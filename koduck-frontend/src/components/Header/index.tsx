import { useAuthStore } from '@/stores/auth'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface HeaderProps {
  title?: string
  subtitle?: string
  tabs?: { key: string; label: string; active?: boolean }[]
  onTabChange?: (key: string) => void
  showSearch?: boolean
}

export default function Header({ 
  title = 'The Fluid Ledger', 
  subtitle,
  tabs = [],
  onTabChange,
  showSearch = true 
}: HeaderProps) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <header className="fixed top-0 right-0 left-64 z-30 h-16 glass-panel border-b-0 rounded-none flex items-center justify-between px-6">
      {/* Left: Title & Tabs */}
      <div className="flex items-center gap-6">
        <div>
          <h1 className="font-headline font-bold text-xl text-fluid-primary">{title}</h1>
          {subtitle && <p className="text-xs text-fluid-text-muted font-mono-data">{subtitle}</p>}
        </div>
        
        {/* Tabs */}
        {tabs.length > 0 && (
          <nav className="flex items-center gap-1 ml-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange?.(tab.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  tab.active
                    ? 'bg-fluid-primary/10 text-fluid-primary'
                    : 'text-fluid-text-muted hover:text-fluid-text hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Right: Search & Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        {showSearch && (
          <div className={`relative transition-all duration-200 ${searchFocused ? 'w-72' : 'w-56'}`}>
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-fluid-text-dim text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Search Markets..."
              className="w-full h-9 pl-10 pr-4 bg-fluid-surface-container-low border border-fluid-outline-variant rounded-lg text-sm text-fluid-text placeholder:text-fluid-text-dim focus:outline-none focus:border-fluid-primary-dim transition-all"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
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
            className="ml-2 w-9 h-9 rounded-full bg-gradient-to-br from-fluid-primary/30 to-fluid-primary/10 border border-fluid-primary/30 flex items-center justify-center text-fluid-primary font-medium text-sm hover:border-fluid-primary/50 hover:shadow-glow-primary/30 transition-all"
          >
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </button>
        </div>
      </div>
    </header>
  )
}
