import { useCallback } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

export function useToast() {
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    void message
    void type
  }, [])

  return { showToast }
}
