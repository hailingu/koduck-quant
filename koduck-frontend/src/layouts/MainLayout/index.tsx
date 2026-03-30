import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useThemeStore } from '@/stores/theme'

export default function MainLayout() {
  const location = useLocation()
  const isDashboard = location.pathname === '/dashboard'
  const { sidebarCollapsed } = useThemeStore()

  return (
    <div className="min-h-screen bg-fluid-surface-container-lowest">
      {/* Sidebar - Fixed 64 */}
      <Sidebar />

      {/* Header - Fixed with left offset */}
      <Header
        tabs={isDashboard ? [
          { key: 'indices', label: 'Indices', active: true },
          { key: 'volume', label: 'Volume' },
          { key: 'volatility', label: 'Volatility' },
        ] : []}
      />

      {/* Main Content */}
      <main className={`h-screen pt-16 pb-8 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'pl-16' : 'pl-64'}`}>
        <div className="h-full p-6 overflow-hidden">
          <Outlet />
        </div>
      </main>
      
      {/* Footer Info Bar */}
      <footer className={`fixed bottom-0 right-0 h-8 bg-fluid-surface-container-low border-t border-fluid-outline-variant/30 flex items-center justify-between px-6 z-20 transition-all duration-300 ${sidebarCollapsed ? 'left-16' : 'left-64'}`}>
        <div className="flex items-center gap-4 text-[10px] text-fluid-text-dim font-mono-data">
          <span>© 2024 THE FLUID LEDGER</span>
          <span className="text-fluid-outline-variant">|</span>
          <span>SYSTEM_HEALTH: <span className="text-fluid-primary">OPTIMAL</span></span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-fluid-text-dim font-mono-data">
          <span>DATA SOURCES: <span className="text-fluid-primary">LIVE</span></span>
          <span className="text-fluid-outline-variant">|</span>
          <span>EN/USD</span>
        </div>
      </footer>
    </div>
  )
}
