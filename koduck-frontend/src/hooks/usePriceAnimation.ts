import { useState, useEffect, useRef } from 'react'

export type PriceAnimation = 'up' | 'down' | null

/**
 * Hook for price change animation
 * Returns animation state when price changes
 * 
 * @example
 * const animation = usePriceAnimation(price)
 * // animation: 'up' | 'down' | null
 */
export function usePriceAnimation(price: number | null | undefined): PriceAnimation {
  const [animation, setAnimation] = useState<PriceAnimation>(null)
  const prevPrice = useRef<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (price === null || price === undefined) {
      prevPrice.current = null
      return
    }

    // Skip first render (no animation on initial load)
    if (prevPrice.current !== null) {
      if (price > prevPrice.current) {
        setAnimation('up')
      } else if (price < prevPrice.current) {
        setAnimation('down')
      }

      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Reset animation after 500ms
      timeoutRef.current = setTimeout(() => {
        setAnimation(null)
      }, 500)
    }

    prevPrice.current = price

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [price])

  return animation
}

/**
 * Hook for tracking last update time
 * Returns formatted time string like "3秒前"
 * 
 * @example
 * const timeAgo = useLastUpdateTime(timestamp)
 * // timeAgo: "刚刚" | "3秒前" | "1分钟前" | ...
 */
export function useLastUpdateTime(timestamp: number | null): string {
  const [timeAgo, setTimeAgo] = useState<string>('')

  useEffect(() => {
    if (!timestamp) {
      setTimeAgo('')
      return
    }

    const updateTimeAgo = () => {
      const now = Date.now()
      const diff = now - timestamp
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)

      if (seconds < 5) {
        setTimeAgo('刚刚')
      } else if (seconds < 60) {
        setTimeAgo(`${seconds}秒前`)
      } else if (minutes < 60) {
        setTimeAgo(`${minutes}分钟前`)
      } else if (hours < 24) {
        setTimeAgo(`${hours}小时前`)
      } else {
        setTimeAgo(new Date(timestamp).toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }))
      }
    }

    updateTimeAgo()
    const interval = setInterval(updateTimeAgo, 1000)

    return () => clearInterval(interval)
  }, [timestamp])

  return timeAgo
}
