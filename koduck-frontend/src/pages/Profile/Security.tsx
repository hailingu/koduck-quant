import { Shield, Lock, Smartphone, History } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/hooks/useToast'

export default function Security() {
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: '',
  })
  const { showToast } = useToast()

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.new !== passwordForm.confirm) {
      showToast('两次输入的密码不一致', 'error')
      return
    }
    showToast('密码修改成功', 'success')
    setPasswordForm({ current: '', new: '', confirm: '' })
  }

  return (
    <div className="max-w-2xl">
      <h3 className="font-headline font-bold text-xl text-fluid-text mb-6">
        账户安全
      </h3>

      {/* Security Status */}
      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-green-400" />
          <div>
            <div className="font-medium text-green-400">账户安全等级：高</div>
            <div className="text-sm text-fluid-text-muted">已开启双重验证</div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Change Password */}
        <div className="p-6 bg-fluid-surface-container/50 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-fluid-primary" />
            <span className="font-medium text-fluid-text">修改密码</span>
          </div>
          
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <input
              type="password"
              placeholder="当前密码"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
              className="w-full px-4 py-2.5 bg-fluid-surface-container border border-fluid-surface-higher rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary"
            />
            <input
              type="password"
              placeholder="新密码"
              value={passwordForm.new}
              onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
              className="w-full px-4 py-2.5 bg-fluid-surface-container border border-fluid-surface-higher rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary"
            />
            <input
              type="password"
              placeholder="确认新密码"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              className="w-full px-4 py-2.5 bg-fluid-surface-container border border-fluid-surface-higher rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-fluid-primary text-fluid-surface-container-lowest rounded-lg text-sm font-medium hover:bg-fluid-primary/90 transition-colors"
            >
              修改密码
            </button>
          </form>
        </div>

        {/* 2FA */}
        <div className="p-6 bg-fluid-surface-container/50 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-fluid-primary" />
              <div>
                <div className="font-medium text-fluid-text">双重验证 (2FA)</div>
                <div className="text-sm text-fluid-text-muted">已绑定手机 +86 138****8888</div>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
              已开启
            </span>
          </div>
        </div>

        {/* Login History */}
        <div className="p-6 bg-fluid-surface-container/50 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <History className="w-5 h-5 text-fluid-primary" />
            <span className="font-medium text-fluid-text">最近登录</span>
          </div>
          <div className="space-y-3 text-sm">
            {[
              { device: 'Chrome / macOS', location: '上海', time: '2024-03-20 14:30', current: true },
              { device: 'Safari / iOS', location: '上海', time: '2024-03-19 09:15', current: false },
            ].map((log, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-fluid-surface-higher/50 last:border-0">
                <div>
                  <div className="text-fluid-text">{log.device}</div>
                  <div className="text-fluid-text-muted">{log.location} · {log.time}</div>
                </div>
                {log.current && (
                  <span className="text-xs text-fluid-primary">当前会话</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
