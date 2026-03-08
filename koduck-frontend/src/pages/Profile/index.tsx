import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

// 导航菜单配置
const menuItems = [
  {
    key: 'overview',
    label: '概览',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    path: '/profile',
  },
  {
    key: 'profile',
    label: '个人资料',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    path: '/profile/edit',
  },
  {
    key: 'preferences',
    label: '偏好设置',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    path: '/profile/preferences',
  },
  {
    key: 'security',
    label: '账户安全',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    path: '/profile/security',
  },
  {
    key: 'api',
    label: 'API管理',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    path: '/profile/api',
  },
  {
    key: 'data',
    label: '数据管理',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    path: '/profile/data',
  },
]

// Mock数据 - 仅用于非用户相关的统计数据
const mockStats = {
  watchlistCount: 15,
  apiKeyCount: 2,
  memberLevel: '高级会员',
  expireDate: '2026-12-31',
}

// 默认用户信息（当auth store中没有时作为fallback）
const defaultUserInfo = {
  nickname: '',
  email: '',
  avatarUrl: null,
  createdAt: '2024-01-15',
  memberSince: '2024年1月',
}

// 概览页面组件
function OverviewTab() {
  // 从auth store获取登录用户信息
  const authUser = useAuthStore((state) => state.user)
  
  // 合并auth user和默认信息（优先使用auth user中的数据）
  const currentUser = {
    username: authUser?.username || '用户',
    nickname: authUser?.nickname || defaultUserInfo.nickname,
    email: authUser?.email || defaultUserInfo.email,
    avatarUrl: authUser?.avatarUrl || defaultUserInfo.avatarUrl,
    createdAt: defaultUserInfo.createdAt,
    memberSince: defaultUserInfo.memberSince,
  }

  return (
    <div className="space-y-6">
      {/* 头像和基本信息卡片 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {currentUser.username.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{currentUser.nickname || currentUser.username}</h3>
            <p className="text-gray-600 dark:text-gray-400">{currentUser.email}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">注册时间：{currentUser.createdAt}</p>
          </div>
        </div>
      </div>

      {/* 账户状态 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">账户状态</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <span className="text-gray-600 dark:text-gray-400">会员等级</span>
            <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
              {mockStats.memberLevel}
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <span className="text-gray-600 dark:text-gray-400">到期时间</span>
            <span className="text-gray-900 dark:text-white font-medium">{mockStats.expireDate}</span>
          </div>
        </div>
      </div>

      {/* 快捷统计 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">快捷统计</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{mockStats.watchlistCount}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">自选股</div>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{mockStats.apiKeyCount}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">API密钥</div>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">0</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">监控策略</div>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">0</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">交易记录</div>
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">快捷操作</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-300">编辑资料</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-300">修改密码</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-300">API密钥</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-300">导出数据</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// 个人资料编辑页面组件
function ProfileEditTab() {
  const authUser = useAuthStore((state) => state.user)
  const [nickname, setNickname] = useState(authUser?.nickname || defaultUserInfo.nickname)
  const [email, setEmail] = useState(authUser?.email || defaultUserInfo.email)
  
  // 使用登录用户的用户名
  const username = authUser?.username || '用户'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    alert('资料更新成功！')
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">个人资料</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
            <span className="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {username.charAt(0).toUpperCase()}
            </span>
          </div>
          <button type="button" className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm">
            更换头像
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">用户名</label>
            <input
              type="text"
              value={username}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">昵称</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button type="submit" className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
            保存修改
          </button>
        </div>
      </form>
    </div>
  )
}

// 偏好设置页面组件
function PreferencesTab() {
  const [theme, setTheme] = useState('light')
  const [notifications, setNotifications] = useState(true)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">偏好设置</h3>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-gray-900 dark:text-white font-medium">主题模式</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">选择您喜欢的主题风格</p>
          </div>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="light">浅色模式</option>
            <option value="dark">深色模式</option>
            <option value="auto">跟随系统</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-gray-900 dark:text-white font-medium">消息通知</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">接收系统通知和提醒</p>
          </div>
          <button
            onClick={() => setNotifications(!notifications)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              notifications ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                notifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-gray-900 dark:text-white font-medium">语言设置</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">选择界面显示语言</p>
          </div>
          <select className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
    </div>
  )
}

// 账户安全页面组件
function SecurityTab() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      alert('两次输入的密码不一致')
      return
    }
    alert('密码修改成功！')
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">账户安全</h3>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">当前密码</label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="请输入当前密码"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">新密码</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="请输入新密码"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">确认新密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="请再次输入新密码"
          />
        </div>
        <button type="submit" className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
          修改密码
        </button>
      </form>
    </div>
  )
}

// API管理页面组件
function ApiManagementTab() {
  const [apiKeys] = useState([
    { id: 1, name: '生产环境', key: 'ak_xxxx...xxxx1234', createdAt: '2024-06-01', status: 'active' },
    { id: 2, name: '测试环境', key: 'ak_xxxx...xxxx5678', createdAt: '2024-08-15', status: 'active' },
  ])

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">API管理</h3>
          <button className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm">
            创建API密钥
          </button>
        </div>

        <div className="space-y-4">
          {apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <h4 className="text-gray-900 dark:text-white font-medium">{apiKey.name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{apiKey.key}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">创建于：{apiKey.createdAt}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">
                  正常
                </span>
                <button className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button className="p-2 text-red-500 hover:text-red-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// 数据管理页面组件
function DataManagementTab() {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">数据管理</h3>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <h4 className="text-gray-900 dark:text-white font-medium">导出个人数据</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">下载您的所有个人数据</p>
            </div>
            <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm">
              导出
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <h4 className="text-gray-900 dark:text-white font-medium">同步数据</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">与云端同步您的数据</p>
            </div>
            <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm">
              同步
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div>
              <h4 className="text-red-700 dark:text-red-300 font-medium">删除账户</h4>
              <p className="text-sm text-red-600 dark:text-red-400">永久删除您的账户和所有数据</p>
            </div>
            <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 面包屑导航组件
function Breadcrumb() {
  const location = useLocation()
  const currentPath = location.pathname

  const getBreadcrumb = () => {
    if (currentPath === '/profile') return ['个人中心', '概览']
    if (currentPath === '/profile/edit') return ['个人中心', '个人资料']
    if (currentPath === '/profile/preferences') return ['个人中心', '偏好设置']
    if (currentPath === '/profile/security') return ['个人中心', '账户安全']
    if (currentPath === '/profile/api') return ['个人中心', 'API管理']
    if (currentPath === '/profile/data') return ['个人中心', '数据管理']
    return ['个人中心']
  }

  const breadcrumb = getBreadcrumb()

  return (
    <nav className="flex items-center gap-2 text-sm mb-4">
      <span className="text-gray-500 dark:text-gray-400">首页</span>
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      {breadcrumb.map((item, index) => (
        <span key={index} className="flex items-center gap-2">
          <span className={index === breadcrumb.length - 1 ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}>
            {item}
          </span>
          {index < breadcrumb.length - 1 && (
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </span>
      ))}
    </nav>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const location = useLocation()

  // 根据当前路径确定激活的菜单项
  const getActiveKey = () => {
    const path = location.pathname
    if (path === '/profile') return 'overview'
    if (path === '/profile/edit') return 'profile'
    if (path === '/profile/preferences') return 'preferences'
    if (path === '/profile/security') return 'security'
    if (path === '/profile/api') return 'api'
    if (path === '/profile/data') return 'data'
    return 'overview'
  }

  const activeKey = getActiveKey()

  // 渲染当前激活的内容
  const renderContent = () => {
    switch (activeKey) {
      case 'overview':
        return <OverviewTab />
      case 'profile':
        return <ProfileEditTab />
      case 'preferences':
        return <PreferencesTab />
      case 'security':
        return <SecurityTab />
      case 'api':
        return <ApiManagementTab />
      case 'data':
        return <DataManagementTab />
      default:
        return <OverviewTab />
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">个人中心</h2>
        <p className="mt-1 text-gray-600 dark:text-gray-400">管理您的个人信息和账户设置</p>
      </div>

      <Breadcrumb />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* 侧边栏导航 */}
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-4">
            <nav className="flex flex-col">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    activeKey === item.key
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-l-4 border-primary-600'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-l-4 border-transparent'
                  }`}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="md:col-span-3">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
