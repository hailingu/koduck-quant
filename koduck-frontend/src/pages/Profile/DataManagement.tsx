import { Database, Download, Trash2, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/hooks/useToast'

export default function DataManagement() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { showToast } = useToast()

  const handleExport = () => {
    showToast('数据导出请求已提交，将发送至您的邮箱', 'success')
  }

  const handleDelete = () => {
    setShowDeleteConfirm(false)
    showToast('账户删除请求已提交', 'warning')
  }

  return (
    <div>
      <h3 className="font-headline font-bold text-xl text-fluid-text mb-6">
        数据管理
      </h3>

      <div className="space-y-6">
        {/* Data Export */}
        <div className="p-6 bg-fluid-surface-container/50 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-fluid-primary/10 flex items-center justify-center">
              <Download className="w-6 h-6 text-fluid-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-fluid-text mb-1">导出个人数据</h4>
              <p className="text-sm text-fluid-text-muted mb-4">
                下载您的所有个人数据，包括个人资料、交易记录、自选股列表等。
                数据将以 JSON 格式打包，发送至您的注册邮箱。
              </p>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-fluid-primary text-fluid-surface-container-lowest rounded-lg text-sm font-medium hover:bg-fluid-primary/90 transition-colors"
              >
                请求导出
              </button>
            </div>
          </div>
        </div>

        {/* Storage Usage */}
        <div className="p-6 bg-fluid-surface-container/50 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-fluid-primary" />
            <h4 className="font-medium text-fluid-text">存储空间</h4>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-fluid-text-muted">已使用</span>
                <span className="text-fluid-text">125 MB / 1 GB</span>
              </div>
              <div className="h-2 bg-fluid-surface-container rounded-full overflow-hidden">
                <div className="h-full w-[12.5%] bg-fluid-primary rounded-full" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-fluid-surface-container rounded-lg">
                <div className="text-lg font-mono-data text-fluid-text">15</div>
                <div className="text-xs text-fluid-text-muted">自选股</div>
              </div>
              <div className="p-3 bg-fluid-surface-container rounded-lg">
                <div className="text-lg font-mono-data text-fluid-text">128</div>
                <div className="text-xs text-fluid-text-muted">预警规则</div>
              </div>
              <div className="p-3 bg-fluid-surface-container rounded-lg">
                <div className="text-lg font-mono-data text-fluid-text">2</div>
                <div className="text-xs text-fluid-text-muted">投资组合</div>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-red-400 mb-1">危险区域</h4>
              <p className="text-sm text-fluid-text-muted mb-4">
                删除账户将永久清除您的所有数据，包括个人资料、交易记录、API 密钥等。
                此操作不可撤销。
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors"
              >
                删除账户
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-panel rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <h4 className="font-bold text-fluid-text">确认删除账户？</h4>
            </div>
            <p className="text-sm text-fluid-text-muted mb-6">
              此操作将永久删除您的账户和所有相关数据，无法恢复。
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-fluid-text-muted hover:text-fluid-text transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
