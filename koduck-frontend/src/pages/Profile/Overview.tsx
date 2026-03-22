import { useState, useEffect } from 'react'
import { 
  User, 
  Mail, 
  Calendar, 
  Crown, 
  Clock,
  Star,
  Key,
  TrendingUp,
  Edit3,
  Lock
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'

// Mock user data - will be replaced with API call
interface UserProfile {
  id: string
  username: string
  email: string
  avatar?: string
  membership: {
    level: 'free' | 'pro' | 'enterprise'
    expiresAt?: string
  }
  stats: {
    watchlistCount: number
    apiKeyCount: number
    portfolioCount: number
    alertsCount: number
  }
  createdAt: string
}

const mockUser: UserProfile = {
  id: '1',
  username: '量化交易者',
  email: 'trader@example.com',
  membership: {
    level: 'pro',
    expiresAt: '2025-12-31T23:59:59Z',
  },
  stats: {
    watchlistCount: 15,
    apiKeyCount: 3,
    portfolioCount: 2,
    alertsCount: 8,
  },
  createdAt: '2024-01-15T08:00:00Z',
}

const membershipConfig = {
  free: { label: '免费版', color: 'text-fluid-text-muted', bgColor: 'bg-fluid-surface-container' },
  pro: { label: '专业版', color: 'text-fluid-primary', bgColor: 'bg-fluid-primary/20' },
  enterprise: { label: '企业版', color: 'text-fluid-tertiary', bgColor: 'bg-fluid-tertiary/20' },
}

function Avatar({ username, avatar }: { username: string; avatar?: string }) {
  if (avatar) {
    return <img src={avatar} alt={username} className="w-20 h-20 rounded-full object-cover" />
  }
  
  return (
    <div className="w-20 h-20 rounded-full bg-fluid-primary/20 flex items-center justify-center">
      <User className="w-10 h-10 text-fluid-primary" />
    </div>
  )
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color = 'primary' 
}: { 
  icon: React.ElementType
  label: string
  value: string | number
  color?: 'primary' | 'secondary' | 'tertiary'
}) {
  const colorClasses = {
    primary: 'text-fluid-primary bg-fluid-primary/10',
    secondary: 'text-fluid-secondary bg-fluid-secondary/10',
    tertiary: 'text-fluid-tertiary bg-fluid-tertiary/10',
  }

  return (
    <div className="glass-panel rounded-xl p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-2xl font-mono-data font-bold text-fluid-text">{value}</div>
        <div className="text-xs text-fluid-text-muted">{label}</div>
      </div>
    </div>
  )
}

function MembershipBadge({ level, expiresAt }: { level: string; expiresAt?: string }) {
  const config = membershipConfig[level as keyof typeof membershipConfig] || membershipConfig.free
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bgColor}`}>
      <Crown className={`w-4 h-4 ${config.color}`} />
      <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
      {expiresAt && (
        <span className="text-xs text-fluid-text-muted ml-1">
          到期: {new Date(expiresAt).toLocaleDateString('zh-CN')}
        </span>
      )}
    </div>
  )
}

export default function Overview() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    // Simulate API call
    const fetchUser = async () => {
      try {
        setLoading(true)
        // In production: const data = await profileApi.getUserProfile()
        await new Promise(resolve => setTimeout(resolve, 500))
        setUser(mockUser)
      } catch (err) {
        showToast('Failed to load user profile', 'error')
      } finally {
        setLoading(false)
      }
    }

    void fetchUser()
  }, [showToast])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-fluid-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-fluid-text-muted">无法加载用户信息</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* User Info Card */}
      <div className="flex items-start gap-6 p-6 bg-fluid-surface-container/50 rounded-xl">
        <Avatar username={user.username} avatar={user.avatar} />
        
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-2xl font-headline font-bold text-fluid-text">
              {user.username}
            </h3>
            <MembershipBadge level={user.membership.level} expiresAt={user.membership.expiresAt} />
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-fluid-text-muted">
            <div className="flex items-center gap-1.5">
              <Mail className="w-4 h-4" />
              <span>{user.email}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>注册于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-fluid-primary text-fluid-surface-container-lowest rounded-lg text-sm font-medium hover:bg-fluid-primary/90 transition-colors">
            <Edit3 className="w-4 h-4" />
            编辑资料
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-fluid-surface-container text-fluid-text rounded-lg text-sm font-medium hover:bg-fluid-surface-higher transition-colors">
            <Lock className="w-4 h-4" />
            修改密码
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div>
        <h4 className="font-headline font-semibold text-fluid-text mb-4">数据概览</h4>
        <div className="grid grid-cols-4 gap-4">
          <StatCard 
            icon={Star} 
            label="自选股" 
            value={user.stats.watchlistCount} 
            color="primary" 
          />
          <StatCard 
            icon={Key} 
            label="API密钥" 
            value={user.stats.apiKeyCount} 
            color="secondary" 
          />
          <StatCard 
            icon={TrendingUp} 
            label="投资组合" 
            value={user.stats.portfolioCount} 
            color="tertiary" 
          />
          <StatCard 
            icon={Clock} 
            label="活跃预警" 
            value={user.stats.alertsCount} 
            color="primary" 
          />
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h4 className="font-headline font-semibold text-fluid-text mb-4">快捷入口</h4>
        <div className="grid grid-cols-3 gap-4">
          <a 
            href="/watchlist" 
            className="p-4 glass-panel rounded-xl hover:bg-fluid-surface-container/80 transition-colors group"
          >
            <Star className="w-8 h-8 text-fluid-primary mb-3 group-hover:scale-110 transition-transform" />
            <div className="font-medium text-fluid-text">我的自选股</div>
            <div className="text-xs text-fluid-text-muted mt-1">管理关注的股票</div>
          </a>
          
          <a 
            href="/portfolio" 
            className="p-4 glass-panel rounded-xl hover:bg-fluid-surface-container/80 transition-colors group"
          >
            <TrendingUp className="w-8 h-8 text-fluid-tertiary mb-3 group-hover:scale-110 transition-transform" />
            <div className="font-medium text-fluid-text">投资组合</div>
            <div className="text-xs text-fluid-text-muted mt-1">查看持仓与盈亏</div>
          </a>
          
          <a 
            href="/kline" 
            className="p-4 glass-panel rounded-xl hover:bg-fluid-surface-container/80 transition-colors group"
          >
            <div className="w-8 h-8 rounded bg-fluid-secondary/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <span className="text-fluid-secondary font-bold text-sm">K</span>
            </div>
            <div className="font-medium text-fluid-text">K线分析</div>
            <div className="text-xs text-fluid-text-muted mt-1">进入技术分析</div>
          </a>
        </div>
      </div>
    </div>
  )
}
