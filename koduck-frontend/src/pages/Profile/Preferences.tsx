import { useState } from 'react'
import { Bell, Moon, Globe, DollarSign } from 'lucide-react'
import { useToast } from '@/hooks/useToast'

export default function Preferences() {
  const [settings, setSettings] = useState({
    theme: 'dark',
    language: 'zh-CN',
    currency: 'CNY',
    notifications: {
      priceAlert: true,
      portfolioUpdate: true,
      marketNews: false,
    },
  })
  const { showToast } = useToast()

  const handleSave = () => {
    showToast('偏好设置已保存', 'success')
  }

  return (
    <div className="max-w-2xl">
      <h3 className="font-headline font-bold text-xl text-fluid-text mb-6">
        偏好设置
      </h3>

      <div className="space-y-6">
        {/* Theme */}
        <div className="p-4 bg-fluid-surface-container/50 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <Moon className="w-5 h-5 text-fluid-primary" />
            <span className="font-medium text-fluid-text">界面主题</span>
          </div>
          <select
            value={settings.theme}
            onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
            className="w-full px-4 py-2 bg-fluid-surface-container border border-fluid-surface-higher rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary"
          >
            <option value="dark">深色模式</option>
            <option value="light">浅色模式</option>
            <option value="system">跟随系统</option>
          </select>
        </div>

        {/* Language */}
        <div className="p-4 bg-fluid-surface-container/50 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <Globe className="w-5 h-5 text-fluid-primary" />
            <span className="font-medium text-fluid-text">语言</span>
          </div>
          <select
            value={settings.language}
            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
            className="w-full px-4 py-2 bg-fluid-surface-container border border-fluid-surface-higher rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary"
          >
            <option value="zh-CN">简体中文</option>
            <option value="zh-TW">繁體中文</option>
            <option value="en-US">English</option>
          </select>
        </div>

        {/* Currency */}
        <div className="p-4 bg-fluid-surface-container/50 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <DollarSign className="w-5 h-5 text-fluid-primary" />
            <span className="font-medium text-fluid-text">默认货币</span>
          </div>
          <select
            value={settings.currency}
            onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
            className="w-full px-4 py-2 bg-fluid-surface-container border border-fluid-surface-higher rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary"
          >
            <option value="CNY">人民币 (CNY)</option>
            <option value="USD">美元 (USD)</option>
            <option value="HKD">港币 (HKD)</option>
          </select>
        </div>

        {/* Notifications */}
        <div className="p-4 bg-fluid-surface-container/50 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-fluid-primary" />
            <span className="font-medium text-fluid-text">通知设置</span>
          </div>
          <div className="space-y-3">
            {[
              { key: 'priceAlert', label: '价格预警通知' },
              { key: 'portfolioUpdate', label: '持仓变动通知' },
              { key: 'marketNews', label: '市场资讯推送' },
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between cursor-pointer">
                <span className="text-fluid-text">{item.label}</span>
                <input
                  type="checkbox"
                  checked={settings.notifications[item.key as keyof typeof settings.notifications]}
                  onChange={(e) => setSettings({
                    ...settings,
                    notifications: {
                      ...settings.notifications,
                      [item.key]: e.target.checked,
                    },
                  })}
                  className="w-5 h-5 rounded border-fluid-surface-higher text-fluid-primary focus:ring-fluid-primary"
                />
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-fluid-primary text-fluid-surface-container-lowest rounded-lg font-medium hover:bg-fluid-primary/90 transition-colors"
        >
          保存设置
        </button>
      </div>
    </div>
  )
}
