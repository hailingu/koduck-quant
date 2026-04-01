import { useEffect, useState, useRef } from 'react'
import type { UserDetail, UpdateProfileRequest, ChangePasswordRequest } from '@/api/user'
import { userApi } from '@/api/user'
import { settingsApi } from '@/api/settings'
import type { UserSettings } from '@/api/settings'
import { useToast } from '@/hooks/useToast'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const LLM_PROVIDERS = ['minimax', 'deepseek', 'openai'] as const
const MEMORY_MODES = ['L0', 'L1', 'L2', 'L3'] as const
type LlmProvider = (typeof LLM_PROVIDERS)[number]
type MemoryMode = (typeof MEMORY_MODES)[number]
type LlmProviderConfig = { apiKey: string; apiBase: string }
type LlmProviderConfigMap = Record<LlmProvider, LlmProviderConfig>
type MemoryLevels = { enableL1: boolean; enableL2: boolean; enableL3: boolean }

const createEmptyLlmProviderConfigMap = (): LlmProviderConfigMap => ({
  minimax: { apiKey: '', apiBase: '' },
  deepseek: { apiKey: '', apiBase: '' },
  openai: { apiKey: '', apiBase: '' },
})

const memoryModeToLevels = (mode: MemoryMode): MemoryLevels => {
  if (mode === 'L1') return { enableL1: true, enableL2: false, enableL3: false }
  if (mode === 'L2') return { enableL1: true, enableL2: true, enableL3: false }
  return { enableL1: true, enableL2: true, enableL3: true }
}

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

// 
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

    const preview = URL.createObjectURL(file)
    setAvatarPreview(preview)

    try {
      const url = await userApi.uploadAvatar(file)
      setProfileData((prev) => ({ ...prev, avatarUrl: url }))
      showToast('头像上传成功', 'success')
    } catch {
      showToast('上传失败', 'error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/20 dark:bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-4 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center">
            <div
              onClick={handleAvatarClick}
              className="relative w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleAvatarClick}
            className="inline-flex h-8 items-center justify-center px-3.5 rounded-full bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-white font-medium text-[13px] shadow-sm border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-colors"
          >
            更换头像
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 dark:border-white/10">
          <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">用户名</span>
          <span className="text-[13px] font-medium text-gray-900 dark:text-white">{user.username}</span>
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">邮箱</span>
          <span className="text-[13px] font-medium text-gray-900 dark:text-white">{user.email || '-'}</span>
        </div>
      </div>

      <div className="pt-4 space-y-4">
        <h4 className="text-[13px] font-medium text-gray-900 dark:text-white">修改密码</h4>
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/20 dark:bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 dark:border-white/10">
            <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">当前密码</span>
            <input
              type="password"
              value={passwordData.oldPassword}
              onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
              className="w-full max-w-[560px] px-0 py-1 bg-transparent border-0 rounded-none text-right text-gray-900 dark:text-white caret-[#0a84ff] focus:outline-none focus:ring-0"
            />
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 dark:border-white/10">
            <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">新密码</span>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              className="w-full max-w-[560px] px-0 py-1 bg-transparent border-0 rounded-none text-right text-gray-900 dark:text-white caret-[#0a84ff] focus:outline-none focus:ring-0"
              minLength={6}
            />
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">确认新密码</span>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              className="w-full max-w-[560px] px-0 py-1 bg-transparent border-0 rounded-none text-right text-gray-900 dark:text-white caret-[#0a84ff] focus:outline-none focus:ring-0"
            />
          </div>
        </div>
      </div>

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

function PreferencesForm({
  settings,
  onSettingsUpdated,
}: {
  settings: UserSettings
  onSettingsUpdated: (s: UserSettings) => void
}) {
  const { showToast } = useToast()
  const { setThemeMode } = useThemeStore()
  const [theme, setTheme] = useState('light')
  const [notifications, setNotifications] = useState(true)
  const [language, setLanguage] = useState('zh-CN')
  const [timezone, setTimezone] = useState('Asia/Shanghai')
  const [llmProvider, setLlmProvider] = useState<LlmProvider>('minimax')
  const [llmConfigs, setLlmConfigs] = useState<LlmProviderConfigMap>(createEmptyLlmProviderConfigMap())
  const [memoryEnabled, setMemoryEnabled] = useState(true)
  const [memoryMode, setMemoryMode] = useState<MemoryMode>('L0')
  const [memoryLevels, setMemoryLevels] = useState<MemoryLevels>(memoryModeToLevels('L0'))
  const [isApiKeyEditing, setIsApiKeyEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTheme(settings.theme || 'light')
    if (settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'auto') {
      setThemeMode(settings.theme)
    }
    setLanguage(settings.language || 'zh-CN')
    setTimezone(settings.timezone || 'Asia/Shanghai')
    const savedProvider = (settings.llmConfig?.provider || '').toLowerCase()
    const activeProvider: LlmProvider = LLM_PROVIDERS.includes(savedProvider as LlmProvider)
      ? (savedProvider as LlmProvider)
      : 'minimax'
    setLlmProvider(activeProvider)
    const nextConfigs = createEmptyLlmProviderConfigMap()
    nextConfigs.minimax = {
      apiKey: settings.llmConfig?.minimax?.apiKey || '',
      apiBase: settings.llmConfig?.minimax?.apiBase || '',
    }
    nextConfigs.deepseek = {
      apiKey: settings.llmConfig?.deepseek?.apiKey || '',
      apiBase: settings.llmConfig?.deepseek?.apiBase || '',
    }
    nextConfigs.openai = {
      apiKey: settings.llmConfig?.openai?.apiKey || '',
      apiBase: settings.llmConfig?.openai?.apiBase || '',
    }
    // ： provider  apiKey/apiBase 
    if (!nextConfigs[activeProvider].apiKey && settings.llmConfig?.apiKey) {
      nextConfigs[activeProvider].apiKey = settings.llmConfig.apiKey
    }
    if (!nextConfigs[activeProvider].apiBase && settings.llmConfig?.apiBase) {
      nextConfigs[activeProvider].apiBase = settings.llmConfig.apiBase
    }
    setLlmConfigs(nextConfigs)

    const savedMemoryEnabled = settings.llmConfig?.memory?.enabled
    const savedMode = settings.llmConfig?.memory?.mode
    const mode: MemoryMode = MEMORY_MODES.includes(savedMode as MemoryMode) ? (savedMode as MemoryMode) : 'L0'
    setMemoryEnabled(savedMemoryEnabled !== false)
    setMemoryMode(mode)
    setMemoryLevels({
      enableL1: settings.llmConfig?.memory?.enableL1 ?? memoryModeToLevels(mode).enableL1,
      enableL2: settings.llmConfig?.memory?.enableL2 ?? memoryModeToLevels(mode).enableL2,
      enableL3: settings.llmConfig?.memory?.enableL3 ?? memoryModeToLevels(mode).enableL3,
    })
  }, [settings, setThemeMode])

  const handleSave = async () => {
    const currentLlmConfig = llmConfigs[llmProvider]
    const providerSpecificConfig =
      llmProvider === 'minimax'
        ? { minimax: { apiKey: currentLlmConfig.apiKey.trim(), apiBase: currentLlmConfig.apiBase.trim() } }
        : llmProvider === 'deepseek'
          ? { deepseek: { apiKey: currentLlmConfig.apiKey.trim(), apiBase: currentLlmConfig.apiBase.trim() } }
          : { openai: { apiKey: currentLlmConfig.apiKey.trim(), apiBase: currentLlmConfig.apiBase.trim() } }
    try {
      setSaving(true)
      const updated = await settingsApi.updateSettings({
        theme,
        language,
        timezone,
        llmConfig: {
          provider: llmProvider.trim(),
          apiKey: currentLlmConfig.apiKey.trim(),
          apiBase: currentLlmConfig.apiBase.trim(),
          memory: {
            enabled: memoryEnabled,
            mode: memoryMode,
            enableL1: memoryLevels.enableL1,
            enableL2: memoryLevels.enableL2,
            enableL3: memoryLevels.enableL3,
          },
          ...providerSpecificConfig,
        },
      })
      onSettingsUpdated(updated)
      showToast('设置已保存', 'success')
    } catch (error: any) {
      showToast(error.message || '保存设置失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleThemeChange = (mode: 'light' | 'dark' | 'auto') => {
    setTheme(mode)
    setThemeMode(mode)
  }

  const maskApiKey = (value: string): string => {
    if (!value) return ''
    if (value.length <= 8) return `${value.slice(0, 2)}****`
    return `${value.slice(0, 4)}****${value.slice(-4)}`
  }

  const handleMemoryModeChange = (mode: MemoryMode) => {
    setMemoryMode(mode)
    setMemoryLevels(memoryModeToLevels(mode))
  }

  const currentLlmConfig = llmConfigs[llmProvider]
  const displayedApiKey = !isApiKeyEditing
    ? maskApiKey(currentLlmConfig.apiKey)
    : currentLlmConfig.apiKey

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/20 dark:bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 dark:border-white/10">
          <h4 className="text-[13px] text-gray-700 dark:text-gray-200 font-medium">主题模式</h4>
          <div className="relative inline-flex items-center rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/10 p-[2px]">
            <span
              className="absolute top-[2px] left-[2px] h-8 w-[80px] rounded-full bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/10 shadow-sm transition-transform duration-300 ease-out"
              style={{ transform: `translateX(${['light', 'dark', 'auto'].indexOf(theme) * 80}px)` }}
            />
            {[
              { value: 'light', label: '浅色' },
              { value: 'dark', label: '深色' },
              { value: 'auto', label: '跟随系统' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleThemeChange(opt.value as 'light' | 'dark' | 'auto')}
                className={`relative z-10 inline-flex h-8 w-[80px] items-center justify-center rounded-full text-[13px] font-medium transition-colors ${
                  theme === opt.value ? 'text-[#1d1d1f] dark:text-white' : 'text-[#6e6e73] dark:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 dark:border-white/10">
          <h4 className="text-[13px] text-gray-700 dark:text-gray-200 font-medium">消息通知</h4>
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

        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <h4 className="text-[13px] text-gray-700 dark:text-gray-200 font-medium">语言设置</h4>
          <div className="relative inline-flex items-center rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/10 p-[2px]">
            <span
              className="absolute top-[2px] left-[2px] h-8 w-[80px] rounded-full bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/10 shadow-sm transition-transform duration-300 ease-out"
              style={{ transform: `translateX(${['zh-CN', 'en'].indexOf(language) * 80}px)` }}
            />
            {[
              { value: 'zh-CN', label: '简体中文' },
              { value: 'en', label: 'English' },
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

      <div className="pt-4 space-y-4">
        <h4 className="text-[13px] text-gray-900 dark:text-white font-medium">AI 大模型配置</h4>

        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/20 dark:bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/10">
            <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">Provider</span>
            <div className="relative inline-flex items-center rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/10 p-[2px]">
              <span
                className="absolute top-[2px] left-[2px] h-8 w-[96px] rounded-full bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/10 shadow-sm transition-transform duration-300 ease-out"
                style={{ transform: `translateX(${LLM_PROVIDERS.indexOf(llmProvider as (typeof LLM_PROVIDERS)[number]) * 96}px)` }}
              />
              {LLM_PROVIDERS.map((provider) => (
                <button
                  key={provider}
                  onClick={() => {
                    setLlmProvider(provider)
                    setIsApiKeyEditing(false)
                  }}
                  className={`relative z-10 inline-flex h-8 w-[96px] items-center justify-center rounded-full text-[13px] font-medium transition-colors ${
                    llmProvider === provider ? 'text-[#1d1d1f] dark:text-white' : 'text-[#6e6e73] dark:text-gray-300'
                  }`}
                >
                  {provider}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 dark:border-white/10">
            <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">API Key</span>
            <input
              type="text"
              value={displayedApiKey}
              onChange={(e) =>
                setLlmConfigs((prev) => ({
                  ...prev,
                  [llmProvider]: { ...prev[llmProvider], apiKey: e.target.value },
                }))
              }
              onFocus={() => setIsApiKeyEditing(true)}
              onBlur={() => setIsApiKeyEditing(false)}
              className="w-full max-w-[560px] px-0 py-1 bg-transparent border-0 rounded-none text-right text-gray-900 dark:text-white caret-[#0a84ff] focus:outline-none focus:ring-0"
            />
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 dark:border-white/10">
            <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">API URL</span>
            <input
              type="text"
              value={currentLlmConfig.apiBase}
              onChange={(e) =>
                setLlmConfigs((prev) => ({
                  ...prev,
                  [llmProvider]: { ...prev[llmProvider], apiBase: e.target.value },
                }))
              }
              className="w-full max-w-[560px] px-0 py-1 bg-transparent border-0 rounded-none text-right text-gray-900 dark:text-white caret-[#0a84ff] focus:outline-none focus:ring-0"
            />
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 dark:border-white/10">
            <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">Memory</span>
            <button
              onClick={() => setMemoryEnabled(!memoryEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                memoryEnabled ? 'bg-[#1d1d1f] dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#1c1c1e] transition-transform shadow-sm ${
                  memoryEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 dark:border-white/10">
            <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">Memory 分级</span>
            <div className="relative inline-flex items-center rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/10 p-[2px]">
              <span
                className="absolute top-[2px] left-[2px] h-8 w-[64px] rounded-full bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/10 shadow-sm transition-transform duration-300 ease-out"
                style={{ transform: `translateX(${MEMORY_MODES.indexOf(memoryMode) * 64}px)` }}
              />
              {MEMORY_MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleMemoryModeChange(mode)}
                  disabled={!memoryEnabled}
                  className={`relative z-10 inline-flex h-8 w-[64px] items-center justify-center rounded-full text-[13px] font-medium transition-colors disabled:opacity-50 ${
                    memoryMode === mode ? 'text-[#1d1d1f] dark:text-white' : 'text-[#6e6e73] dark:text-gray-300'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 dark:border-white/10">
            <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">L1 原始记忆</span>
            <button
              onClick={() => setMemoryLevels((prev) => ({ ...prev, enableL1: !prev.enableL1 }))}
              disabled={!memoryEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                memoryLevels.enableL1 && memoryEnabled ? 'bg-[#1d1d1f] dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#1c1c1e] transition-transform shadow-sm ${
                  memoryLevels.enableL1 && memoryEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 dark:border-white/10">
            <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">L2 主题记忆</span>
            <button
              onClick={() => setMemoryLevels((prev) => ({ ...prev, enableL2: !prev.enableL2 }))}
              disabled={!memoryEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                memoryLevels.enableL2 && memoryEnabled ? 'bg-[#1d1d1f] dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#1c1c1e] transition-transform shadow-sm ${
                  memoryLevels.enableL2 && memoryEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">L3 关键词记忆</span>
            <button
              onClick={() => setMemoryLevels((prev) => ({ ...prev, enableL3: !prev.enableL3 }))}
              disabled={!memoryEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                memoryLevels.enableL3 && memoryEnabled ? 'bg-[#1d1d1f] dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#1c1c1e] transition-transform shadow-sm ${
                  memoryLevels.enableL3 && memoryEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-8 items-center justify-center px-3.5 rounded-full bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-white font-medium text-[13px] shadow-sm border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-[#2c2c2e] disabled:opacity-50 transition-colors"
        >
          {saving ? '保存中...' : '保存偏好'}
        </button>
      </div>
    </div>
  )
}

function AboutSection() {
  const appVersion = __APP_VERSION__.startsWith('v') ? __APP_VERSION__ : `v${__APP_VERSION__}`
  const buildTime = formatBuildTime(__APP_BUILD_TIME__)

  return (
    <div className="space-y-6">
      <div className="text-center py-10 px-4">
        <img src="/logo.png" alt="KODUCK Logo" className="w-16 h-16 mx-auto mb-4 rounded-xl object-cover" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">KODUCK Quant</h3>
        <p className="text-gray-500 dark:text-gray-400">量化交易平台</p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/20 dark:bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 dark:border-white/10">
          <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">版本号</span>
          <span className="text-[13px] font-medium text-gray-900 dark:text-white">{appVersion}</span>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">构建时间</span>
          <span className="text-[13px] font-medium text-gray-900 dark:text-white">{buildTime}</span>
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
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()
  const { logout } = useAuthStore()

  useEffect(() => {
    const loadUser = async () => {
      try {
        const [userData, settingsData] = await Promise.all([userApi.getCurrentUser(), settingsApi.getSettings()])
        setUser(userData)
        setSettings(settingsData)
      } catch {
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
    return <div className="text-center py-16 text-gray-500 dark:text-gray-400">加载失败，请刷新重试</div>
  }

  const tabOrder: Array<'profile' | 'preferences' | 'about'> = ['profile', 'preferences', 'about']
  const activeTabIndex = tabOrder.indexOf(activeTab)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="p-8 space-y-6">
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

        <div
          className={
            activeTab === 'profile' || activeTab === 'preferences' || activeTab === 'about'
              ? ''
              : 'rounded-[20px] border border-[#e5e5ea] dark:border-white/10 bg-[#fbfbfd] dark:bg-[#252527] p-8'
          }
        >
          {activeTab === 'profile' && <ProfileForm user={user} onUpdate={setUser} />}

          {activeTab === 'preferences' && (
            <>
              {settings ? (
                <PreferencesForm settings={settings} onSettingsUpdated={setSettings} />
              ) : (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400">设置加载中...</div>
              )}
            </>
          )}

          {activeTab === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  )
}
