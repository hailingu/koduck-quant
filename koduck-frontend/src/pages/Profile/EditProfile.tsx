import { User, Mail, Camera } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/hooks/useToast'

export default function EditProfile() {
  const [formData, setFormData] = useState({
    username: '量化交易者',
    email: 'trader@example.com',
    bio: '专注A股量化交易，偏好技术分析',
  })
  const { showToast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In production: await profileApi.updateProfile(formData)
    showToast('个人资料已更新', 'success')
  }

  return (
    <div className="max-w-2xl">
      <h3 className="font-headline font-bold text-xl text-fluid-text mb-6">
        编辑个人资料
      </h3>

      {/* Avatar Upload */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-20 h-20 rounded-full bg-fluid-primary/20 flex items-center justify-center">
          <User className="w-10 h-10 text-fluid-primary" />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-fluid-surface-container text-fluid-text rounded-lg text-sm hover:bg-fluid-surface-higher transition-colors">
          <Camera className="w-4 h-4" />
          更换头像
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-fluid-text mb-2">
            用户名
          </label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full px-4 py-2.5 bg-fluid-surface-container border border-fluid-surface-higher rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fluid-text mb-2">
            邮箱
          </label>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="flex-1 px-4 py-2.5 bg-fluid-surface-container border border-fluid-surface-higher rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary"
            />
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              已验证
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-fluid-text mb-2">
            个人简介
          </label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            rows={4}
            className="w-full px-4 py-2.5 bg-fluid-surface-container border border-fluid-surface-higher rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary resize-none"
          />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            className="px-6 py-2.5 bg-fluid-primary text-fluid-surface-container-lowest rounded-lg font-medium hover:bg-fluid-primary/90 transition-colors"
          >
            保存修改
          </button>
        </div>
      </form>
    </div>
  )
}
