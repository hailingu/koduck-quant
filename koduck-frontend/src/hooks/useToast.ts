import { useCallback } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

export function useToast() {
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    // 简单的 toast 实现，使用 console 和 alert
    // 后续可以替换为更复杂的 toast 组件
    const prefix = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️',
    }[type]

    console.log(`${prefix} [${type.toUpperCase()}] ${message}`)

    // 如果是错误，可以显示 alert
    if (type === 'error') {
      // 可以选择是否显示 alert，这里暂时不显示避免干扰
      // alert(`${prefix} ${message}`)
    }
  }, [])

  return { showToast }
}
