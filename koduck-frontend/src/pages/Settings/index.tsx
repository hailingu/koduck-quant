import { useEffect, useState, useRef } from 'react'
import type { UserDetail, UpdateProfileRequest, ChangePasswordRequest } from '@/api/user'
import { userApi } from '@/api/user'
import { useToast } from '@/hooks/useToast'
import { useAuthStore } from '@/stores/auth'

const APPLE_CARD_CLASS =
  'bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5'

const formatBuildTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// 个人资料表单
function ProfileForm({ user, onUpdate }: { user: UserDetail; onUpdate: (u: UserDetail) => void }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [profileData, setProfileData] = useState<UpdateProfileRequest>({})
  const [passwordData, setPasswordData] = useState<ChangePasswordRequest>({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatarUrl)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const isChangingPassword = !!(passwordData.oldPassword || passwordData.newPassword || passwordData.confirmPassword)
    
    if (isChangingPassword) {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        showToast('两次输入的新密码不一致', 'error')
        return
      }
      if (passwordData.newPassword.length < 6) {
        showToast('新密码长度不能少于6位', 'error')
        return
      }
    }

    try {
      setLoading(true)
      let isUpdated = false

      if (Object.keys(profileData).length > 0) {
        const updated = await userApi.updateProfile(profileData)
        onUpdate(updated)
        isUpdated = true
      }

      if (isChangingPassword) {
        await userApi.changePassword(passwordData)
        setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' })
        isUpdated = true
      }

      if (isUpdated) {
        showToast('保存成功', 'success')
        setProfileData({})
      }
    } catch (error: any) {
      showToast(error.message || '保存失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 预览
    const preview = URL.createObjectURL(file)
    setAvatarPreview(preview)

    try {
      const url = await userApi.uploadAvatar(file)
      setProfileData((prev) => ({ ...prev, avatarUrl: url }))
      showToast('头像上传成功', 'success')
    } catch (error) {
      showToast('上传失败', 'error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 头像 */}
      <div className="flex items-center gap-6">
        <div
          onClick={handleAvatarClick}
          className="relative w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {user.username.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div>
          <button
            type="button"
            onClick={handleAvatarClick}
            className="inline-flex h-8 items-center justify-center px-3.5 rounded-full bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-white font-medium text-[13px] shadow-sm border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-colors"
          >
            更换头像
          </button>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">支持 JPG、PNG 格式，大小不超过 2MB</p>
        </div>
      </div>

      {/* 资料展示字段 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-8">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">用户名</div>
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-gray-900 dark:text-white">{user.username}</span>
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">邮箱</div>
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-gray-900 dark:text-white">{user.email || '-'}</span>
          </div>
        </div>
      </div>

      {/* 密码修改字段 */}
      <div className="pt-8 border-t border-gray-200 dark:border-gray-700 mt-8 space-y-6">
        <h4 className="text-base font-medium text-gray-900 dark:text-white">修改密码</h4>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            当前密码
          </label>
          <input
            type="password"
            value={passwordData.oldPassword}
            onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
            className="w-full md:w-1/2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="请输入当前密码（若不修改请留空）"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            新密码
          </label>
          <input
            type="password"
            value={passwordData.newPassword}
            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
            className="w-full md:w-1/2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="请输入新密码"
            minLength={6}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">密码长度至少6位</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            确认新密码
          </label>
          <input
            type="password"
            value={passwordData.confirmPassword}
            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
            className="w-full md:w-1/2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="请再次输入新密码"
          />
        </div>
      </div>

      {/* 提交按钮 */}
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={loading || (Object.keys(profileData).length === 0 && !passwordData.oldPassword && !passwordData.newPassword)}
          className="inline-flex h-8 items-center justify-center px-3.5 rounded-full bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-white font-medium text-[13px] shadow-sm border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-[#2c2c2e] disabled:opacity-50 transition-colors"
        >
          {loading ? '保存中...' : '保存修改'}
        </button>
      </div>
    </form>
  )
}

// 偏好设置表单
function PreferencesForm() {
  const [theme, setTheme] = useState('light')
  const [notifications, setNotifications] = useState(true)
  const [language, setLanguage] = useState('zh-CN')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-gray-900 dark:text-white font-medium">主题模式</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">选择您喜欢的主题风格</p>
        </div>
        <div className="relative inline-flex items-center rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/10 p-[2px]">
          <span
            className="absolute top-[2px] left-[2px] h-8 w-[80px] rounded-full bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/10 shadow-sm transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${['light', 'dark', 'auto'].indexOf(theme) * 80}px)` }}
          />
          {[
            { value: 'light', label: '浅色' },
            { value: 'dark', label: '深色' },
            { value: 'auto', label: '跟随系统' }
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`relative z-10 inline-flex h-8 w-[80px] items-center justify-center rounded-full text-[13px] font-medium transition-colors ${
                theme === opt.value ? 'text-[#1d1d1f] dark:text-white' : 'text-[#6e6e73] dark:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-gray-900 dark:text-white font-medium">消息通知</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">接收系统通知和提醒</p>
        </div>
        <button
          onClick={() => setNotifications(!notifications)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            notifications ? 'bg-[#1d1d1f] dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#1c1c1e] transition-transform shadow-sm ${
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
        <div className="relative inline-flex items-center rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/10 p-[2px]">
          <span
            className="absolute top-[2px] left-[2px] h-8 w-[80px] rounded-full bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/10 shadow-sm transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${['zh-CN', 'en'].indexOf(language) * 80}px)` }}
          />
          {[
            { value: 'zh-CN', label: '简体中文' },
            { value: 'en', label: 'English' }
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLanguage(opt.value)}
              className={`relative z-10 inline-flex h-8 w-[80px] items-center justify-center rounded-full text-[13px] font-medium transition-colors ${
                language === opt.value ? 'text-[#1d1d1f] dark:text-white' : 'text-[#6e6e73] dark:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// 关于页面
function AboutSection() {
  const appVersion = __APP_VERSION__.startsWith('v') ? __APP_VERSION__ : `v${__APP_VERSION__}`
  const buildTime = formatBuildTime(__APP_BUILD_TIME__)

  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <img
          src="/koduck.png"
          alt="KODUCK Logo"
          className="w-16 h-16 mx-auto mb-4 rounded-xl object-cover"
        />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">KODUCK Quant</h3>
        <p className="text-gray-500 dark:text-gray-400">量化交易平台</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between py-3">
          <span className="text-gray-600 dark:text-gray-400">版本号</span>
          <span className="text-gray-900 dark:text-white font-medium">{appVersion}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-gray-600 dark:text-gray-400">构建时间</span>
          <span className="text-gray-900 dark:text-white font-medium">{buildTime}</span>
        </div>
      </div>

      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        <p>© 2025 KODUCK Quant. All rights reserved.</p>
      </div>
    </div>
  )
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'about'>('profile')
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()
  const { logout } = useAuthStore()

  useEffect(() => {
    const loadUser = async () => {
      try {
        const data = await userApi.getCurrentUser()
        setUser(data)
      } catch (error) {
        showToast('加载用户信息失败', 'error')
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [showToast])

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout()
      window.location.href = '/login'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">加载失败，请刷新重试</div>
    )
  }

  const tabOrder: Array<'profile' | 'preferences' | 'about'> = [
    'profile',
    'preferences',
    'about',
  ]
  const activeTabIndex = tabOrder.indexOf(activeTab)

  return (
    <div className="max-w-6xl mx-auto">
      <div className={`${APPLE_CARD_CLASS} p-8 space-y-6`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative inline-flex items-center rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/10 p-[2px]">
            <span
              className="absolute top-[2px] left-[2px] h-8 w-[96px] rounded-full bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/10 shadow-sm transition-transform duration-300 ease-out"
              style={{ transform: `translateX(${Math.max(activeTabIndex, 0) * 96}px)` }}
            />
            <button
              onClick={() => setActiveTab('profile')}
              className={`relative z-10 inline-flex h-8 w-[96px] items-center justify-center rounded-full text-[13px] font-medium transition-colors ${
                activeTab === 'profile' ? 'text-[#1d1d1f] dark:text-white' : 'text-[#6e6e73] dark:text-gray-300'
              }`}
            >
              个人资料
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`relative z-10 inline-flex h-8 w-[96px] items-center justify-center rounded-full text-[13px] font-medium transition-colors ${
                activeTab === 'preferences' ? 'text-[#1d1d1f] dark:text-white' : 'text-[#6e6e73] dark:text-gray-300'
              }`}
            >
              偏好设置
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`relative z-10 inline-flex h-8 w-[96px] items-center justify-center rounded-full text-[13px] font-medium transition-colors ${
                activeTab === 'about' ? 'text-[#1d1d1f] dark:text-white' : 'text-[#6e6e73] dark:text-gray-300'
              }`}
            >
              关于
            </button>
          </div>
          <div className="ml-auto">
            <button
              onClick={handleLogout}
              className="inline-flex h-8 items-center justify-center px-3.5 rounded-full bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-white font-medium text-[13px] shadow-sm border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>

        <div className="rounded-[20px] border border-[#e5e5ea] dark:border-white/10 bg-[#fbfbfd] dark:bg-[#252527] p-8">
          {activeTab === 'profile' && (
            <>
              <ProfileForm user={user} onUpdate={setUser} />
            </>
          )}

          {activeTab === 'preferences' && (
            <>
              <PreferencesForm />
            </>
          )}

          {activeTab === 'about' && (
            <>
              <AboutSection />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
