import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { 
  User, 
  Settings, 
  Shield, 
  Key, 
  Database, 
  LayoutDashboard,
  ChevronRight
} from 'lucide-react'

const menuItems = [
  { path: '/profile', label: '概览', icon: LayoutDashboard },
  { path: '/profile/edit', label: '个人资料', icon: User },
  { path: '/profile/preferences', label: '偏好设置', icon: Settings },
  { path: '/profile/security', label: '账户安全', icon: Shield },
  { path: '/profile/api', label: 'API管理', icon: Key },
  { path: '/profile/data', label: '数据管理', icon: Database },
]

function Breadcrumb() {
  const location = useLocation()
  const currentItem = menuItems.find(item => item.path === location.pathname)
  
  return (
    <div className="flex items-center gap-2 text-sm text-fluid-text-muted mb-6">
      <span>个人中心</span>
      <ChevronRight className="w-4 h-4" />
      <span className="text-fluid-text">{currentItem?.label || '概览'}</span>
    </div>
  )
}

export default function Profile() {
  return (
    <div className="h-[calc(100vh-140px)] grid grid-cols-12 gap-6">
      {/* Sidebar */}
      <div className="col-span-3">
        <div className="glass-panel rounded-xl p-4 sticky top-4">
          <h2 className="font-headline font-bold text-lg text-fluid-text mb-4 px-2">
            个人中心
          </h2>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/profile'}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                    transition-all duration-200
                    ${isActive 
                      ? 'bg-fluid-primary/20 text-fluid-primary font-medium' 
                      : 'text-fluid-text-muted hover:text-fluid-text hover:bg-fluid-surface-container'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="col-span-9">
        <Breadcrumb />
        <div className="glass-panel rounded-xl p-6 min-h-[500px]">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
