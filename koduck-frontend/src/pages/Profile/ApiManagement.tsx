import { useState } from 'react'
import { Key, Copy, Trash2, Plus, Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/hooks/useToast'

interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsed: string
  permissions: string[]
}

const mockApiKeys: ApiKey[] = [
  {
    id: '1',
    name: '交易机器人',
    key: 'pk_live_51H7x...8j2K',
    createdAt: '2024-03-01',
    lastUsed: '2024-03-20',
    permissions: ['读取行情', '交易'],
  },
  {
    id: '2',
    name: '数据分析',
    key: 'pk_live_9k3M...2p9L',
    createdAt: '2024-02-15',
    lastUsed: '2024-03-19',
    permissions: ['读取行情'],
  },
]

export default function ApiManagement() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(mockApiKeys)
  const [showKey, setShowKey] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  const { showToast } = useToast()

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key)
    showToast('API Key 已复制', 'success')
  }

  const handleDelete = (id: string) => {
    setApiKeys(apiKeys.filter(k => k.id !== id))
    showToast('API Key 已删除', 'success')
  }

  const handleCreate = () => {
    if (!newKeyName.trim()) return
    const newKey: ApiKey = {
      id: Date.now().toString(),
      name: newKeyName,
      key: 'pk_live_' + Math.random().toString(36).substring(2, 15),
      createdAt: new Date().toISOString().split('T')[0],
      lastUsed: '从未使用',
      permissions: ['读取行情'],
    }
    setApiKeys([...apiKeys, newKey])
    setNewKeyName('')
    showToast('API Key 创建成功', 'success')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-headline font-bold text-xl text-fluid-text">
          API 密钥管理
        </h3>
      </div>

      {/* Create New Key */}
      <div className="p-4 bg-fluid-surface-container/50 rounded-xl mb-6">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="输入密钥名称..."
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-fluid-surface-container border border-fluid-surface-higher rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary"
          />
          <button
            onClick={handleCreate}
            disabled={!newKeyName.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-fluid-primary text-fluid-surface-container-lowest rounded-lg font-medium hover:bg-fluid-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            创建密钥
          </button>
        </div>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.map((apiKey) => (
          <div key={apiKey.id} className="p-4 glass-panel rounded-xl">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-fluid-primary" />
                <span className="font-medium text-fluid-text">{apiKey.name}</span>
              </div>
              <button
                onClick={() => handleDelete(apiKey.id)}
                className="p-2 text-fluid-text-muted hover:text-fluid-secondary transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 px-3 py-2 bg-fluid-surface-container rounded-lg text-sm font-mono-data text-fluid-text">
                {showKey === apiKey.id ? apiKey.key : apiKey.key.substring(0, 15) + '...'}
              </code>
              <button
                onClick={() => setShowKey(showKey === apiKey.id ? null : apiKey.id)}
                className="p-2 text-fluid-text-muted hover:text-fluid-text transition-colors"
              >
                {showKey === apiKey.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleCopy(apiKey.key)}
                className="p-2 text-fluid-text-muted hover:text-fluid-text transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs text-fluid-text-muted">
              <span>创建于: {apiKey.createdAt}</span>
              <span>最后使用: {apiKey.lastUsed}</span>
              <span className="px-2 py-0.5 bg-fluid-surface-container rounded">
                {apiKey.permissions.join(', ')}
              </span>
            </div>
          </div>
        ))}

        {apiKeys.length === 0 && (
          <div className="text-center py-12 text-fluid-text-muted">
            暂无 API 密钥
          </div>
        )}
      </div>
    </div>
  )
}
