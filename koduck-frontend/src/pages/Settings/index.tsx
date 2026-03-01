import { useEffect, useState, useRef } from 'react'
import type { UserDetail, UpdateProfileRequest, ChangePasswordRequest } from '@/api/user'
import { userApi } from '@/api/user'
import { useToast } from '@/hooks/useToast'
import { useAuthStore } from '@/stores/auth'

// 个人资料表单
function ProfileForm({ user, onUpdate }: { user: UserDetail; onUpdate: (u: UserDetail) => void }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<UpdateProfileRequest>({
    nickname: user.nickname,
    email: user.email,
    phone: user.phone || '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      const updated = await userApi.updateProfile(formData)
      onUpdate(updated)
      showToast('资料更新成功', 'success')
    } catch (error) {
      showToast('更新失败', 'error')
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
      setFormData((prev) => ({ ...prev, avatar: url }))
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
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm"
          >
            更换头像
          </button>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">支持 JPG、PNG 格式，大小不超过 2MB</p>
        </div>
      </div>

      {/* 表单字段 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            用户名
          </label>
          <input
            type="text"
            value={user.username}
            disabled
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">用户名不可修改</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            昵称
          </label>
          <input
            type="text"
            value={formData.nickname}
            onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="请输入昵称"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            邮箱
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="请输入邮箱"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            手机号
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="请输入手机号"
          />
        </div>
      </div>

      {/* 注册时间 */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          注册时间: {new Date(user.createdAt).toLocaleString('zh-CN')}
        </div>
      </div>

      {/* 提交按钮 */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {loading ? '保存中...' : '保存修改'}
        </button>
      </div>
    </form>
  )
}

// 安全设置表单
function SecurityForm() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<ChangePasswordRequest>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.newPassword !== formData.confirmPassword) {
      showToast('两次输入的新密码不一致', 'error')
      return
    }

    if (formData.newPassword.length < 6) {
      showToast('新密码长度不能少于6位', 'error')
      return
    }

    try {
      setLoading(true)
      await userApi.changePassword(formData)
      showToast('密码修改成功', 'success')
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error: any) {
      showToast(error.message || '修改失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          当前密码
        </label>
        <input
          type="password"
          value={formData.currentPassword}
          onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="请输入当前密码"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          新密码
        </label>
        <input
          type="password"
          value={formData.newPassword}
          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="请输入新密码"
          required
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
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="请再次输入新密码"
          required
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {loading ? '修改中...' : '修改密码'}
        </button>
      </div>
    </form>
  )
}

// 关于页面
function AboutSection() {
  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary-600 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">K</span>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">KODUCK Quant</h3>
        <p className="text-gray-500 dark:text-gray-400">量化交易平台</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
          <span className="text-gray-600 dark:text-gray-400">版本号</span>
          <span className="text-gray-900 dark:text-white font-medium">v1.0.0</span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
          <span className="text-gray-600 dark:text-gray-400">构建时间</span>
          <span className="text-gray-900 dark:text-white font-medium">2025-03-01</span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
          <span className="text-gray-600 dark:text-gray-400">技术栈</span>
          <span className="text-gray-900 dark:text-white font-medium">React + Spring Boot</span>
        </div>
      </div>

      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        <p>© 2025 KODUCK Quant. All rights reserved.</p>
      </div>
    </div>
  )
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'about'>('profile')
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">用户中心</h2>
        <p className="mt-1 text-gray-600 dark:text-gray-400">管理您的个人信息和账户安全</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <nav className="flex flex-col">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  activeTab === 'profile'
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-l-4 border-primary-600'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                个人资料
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  activeTab === 'security'
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-l-4 border-primary-600'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                安全设置
              </button>
              <button
                onClick={() => setActiveTab('about')}
                className={`flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  activeTab === 'about'
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-l-4 border-primary-600'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                关于
              </button>
              <div className="border-t border-gray-200 dark:border-gray-700"></div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                退出登录
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="md:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            {activeTab === 'profile' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">个人资料</h3>
                <ProfileForm user={user} onUpdate={setUser} />
              </>
            )}

            {activeTab === 'security' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">安全设置</h3>
                <SecurityForm />
              </>
            )}

            {activeTab === 'about' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">关于</h3>
                <AboutSection />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
