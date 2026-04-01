import { NavLink, useLocation } from 'react-router-dom'
import { useThemeStore } from '@/stores/theme'

interface MenuItem {
  key: string
  label: string
  path: string
  icon: string
}

const mainMenuItems: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
  { key: 'ai', label: 'Aura AI', path: '/ai', icon: 'auto_awesome' },
  { key: 'sector', label: 'Sector Network', path: '/sector', icon: 'hub' },
  { key: 'fundflow', label: 'Flow Game', path: '/fundflow', icon: 'water' },
  { key: 'watchlist', label: 'Watchlist', path: '/watchlist', icon: 'star' },
  { key: 'kline', label: 'K-Line Analysis', path: '/kline', icon: 'candlestick_chart' },
  { key: 'portfolio', label: 'Portfolio', path: '/portfolio', icon: 'account_balance_wallet' },
]

const bottomLinks = [
  { label: 'Support', icon: 'help', href: '#' },
  { label: 'API', icon: 'code', href: '#' },
]

export default function Sidebar() {
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar } = useThemeStore()

  return (
    <aside className={`fixed left-0 top-0 z-40 h-screen bg-fluid-surface-container-lowest border-r border-fluid-outline-variant/30 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo Area */}
      <div className={`pb-4 ${sidebarCollapsed ? 'p-3 pt-6' : 'p-6'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-fluid-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-fluid-primary text-xl">waves</span>
          </div>
          {!sidebarCollapsed && (
            <div>
              <h1 className="font-headline font-bold text-lg text-white leading-tight">Market Cockpit</h1>
              <p className="text-[10px] text-fluid-primary tracking-wider uppercase font-mono-data">High-Pressure Liquidity</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto scrollbar-hide">
        {mainMenuItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          return (
            <NavLink
              key={item.key}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-r from-fluid-primary/10 to-transparent text-fluid-primary border-l-4 border-fluid-primary rounded-r-lg translate-x-1'
                  : 'text-fluid-text-muted hover:text-fluid-text hover:bg-white/5 border-l-4 border-transparent rounded-lg'
              }`}
            >
              <span className={`material-symbols-outlined text-lg ${isActive ? 'text-fluid-primary' : 'group-hover:text-fluid-text'}`}>
                {item.icon}
              </span>
              {!sidebarCollapsed && <span className="font-medium text-sm tracking-wide">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom Links */}
      <div className={`py-4 border-t border-fluid-outline-variant/30 ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
        <div className={`flex items-center ${sidebarCollapsed ? 'flex-col gap-3' : 'justify-between gap-2'}`}>
          <div className={`flex ${sidebarCollapsed ? 'flex-col items-center gap-3' : 'items-center gap-4'}`}>
            {bottomLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`flex items-center text-fluid-text-dim hover:text-fluid-text transition-colors ${sidebarCollapsed ? 'justify-center w-8 h-8 rounded-lg hover:bg-white/5' : 'gap-1.5 text-xs'}`}
                title={link.label}
              >
                <span className={`material-symbols-outlined ${sidebarCollapsed ? 'text-lg' : 'text-sm'}`}>{link.icon}</span>
                {!sidebarCollapsed && <span>{link.label}</span>}
              </a>
            ))}
          </div>
          {/* Collapse Button */}
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-fluid-text-dim hover:text-fluid-text hover:bg-white/5 transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-symbols-outlined text-lg">
              {sidebarCollapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>
      </div>
    </aside>
  )
}
