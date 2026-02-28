function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Koduck Quant
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          量化交易平台
        </p>
        <div className="flex gap-4">
          <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            开始使用
          </button>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">
            了解更多
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
