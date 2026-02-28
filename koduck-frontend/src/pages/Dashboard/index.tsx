import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'

export default function Dashboard() {
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } finally {
      logout()
      window.location.href = '/login'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Koduck Quant</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-700 dark:text-gray-300">欢迎，{user?.username}</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">仪表盘</h2>
          <p className="text-gray-600 dark:text-gray-400">
            欢迎回来！这是您的个人仪表盘。
          </p>
          
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-primary-50 dark:bg-primary-900/20 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100">自选股</h3>
              <p className="mt-2 text-3xl font-bold text-primary-600">0</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">持仓</h3>
              <p className="mt-2 text-3xl font-bold text-green-600">0</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">今日盈亏</h3>
              <p className="mt-2 text-3xl font-bold text-purple-600">¥0.00</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
