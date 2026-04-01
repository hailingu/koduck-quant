import { memo, useEffect, useRef, useState } from 'react'
import { isTradingHours } from '@/utils/trading'

export interface PriceDisplayProps {
  /**  */
  price: number | null
  /**  */
  prevClose?: number | null
  /** （） */
  open?: number | null
  /**  */
  changePercent?: number | null
  /**  */
  className?: string
  /** （""） */
  showLabel?: boolean
  /**  */
  decimals?: number
  /** ：compact=，full= */
  mode?: 'compact' | 'full'
  /** （） */
  breathing?: boolean
  /** （ websocket ）， */
  pulseKey?: number
}

/**
 * （）
 * - ：/
 * - ：
 * - 
 */
export const PriceDisplay = memo(function PriceDisplay({
  price,
  prevClose,
  open,
  changePercent,
  className = '',
  showLabel = false,
  decimals = 2,
  mode = 'compact',
  breathing = true,
  pulseKey,
}: PriceDisplayProps) {
  // 
  const trading = isTradingHours()
  
  // 
  const [isBreathing, setIsBreathing] = useState(false)
  const [breathColor, setBreathColor] = useState<'up' | 'down' | null>(null)
  const [lastUpdateTime, setLastUpdateTime] = useState(0)
  const breathTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // （）
  useEffect(() => {
    const animateAllowed = mode === 'compact' ? true : trading
    if (!breathing || !animateAllowed || price === null) return
    
    const now = Date.now()
    //  500ms，
    if (now - lastUpdateTime < 500) return
    
    setLastUpdateTime(now)
    
    // （）（A：）
    // ，
    const referencePrice = open || prevClose
    if (referencePrice && price > referencePrice) {
      setBreathColor('up') //  - 
    } else if (referencePrice && price < referencePrice) {
      setBreathColor('down') //  - 
    } else if ((changePercent ?? 0) > 0) {
      setBreathColor('up')
    } else if ((changePercent ?? 0) < 0) {
      setBreathColor('down')
    } else {
      setBreathColor(null) //  - 
    }
    
    // 
    setIsBreathing(true)
    
    // 
    if (breathTimeoutRef.current) {
      clearTimeout(breathTimeoutRef.current)
    }
    
    // 600ms 
    breathTimeoutRef.current = setTimeout(() => {
      setIsBreathing(false)
    }, 600)
    
    return () => {
      if (breathTimeoutRef.current) {
        clearTimeout(breathTimeoutRef.current)
      }
    }
  }, [price, breathing, trading, mode, lastUpdateTime, open, prevClose, changePercent, pulseKey])

  // （）
  const isUp = (changePercent ?? 0) > 0
  const isDown = (changePercent ?? 0) < 0

  // （A：）
  const getColorClass = () => {
    if (isUp) return 'text-stock-up'
    if (isDown) return 'text-stock-down'
    return 'text-gray-600 dark:text-gray-400'
  }

  // 
  const formatPrice = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '--'
    }
    return value.toFixed(decimals)
  }

  // 
  const formatChangePercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '--%'
    }
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  // （）
  const getBreathClass = () => {
    if (!isBreathing || !breathColor) return ''
    return breathColor === 'up' ? 'animate-price-breath-up' : 'animate-price-breath-down'
  }

  // （）
  if (mode === 'full') {
    return (
      <div className={`flex items-baseline gap-3 ${className}`}>
        {/*  -  */}
        <span className={`text-5xl font-bold tracking-tight ${getColorClass()} ${getBreathClass()}`}>
          {formatPrice(price)}
        </span>
        {/*  -  */}
        <span className={`text-lg ${getColorClass()}`}>
          {formatChangePercent(changePercent)}
        </span>
        {showLabel && (
          <span className="ml-2 text-sm text-gray-500">
            {trading ? '交易中' : '已收盘'}
          </span>
        )}
      </div>
    )
  }

  // （，）
  const priceClasses = [
    'price-display',
    isUp ? 'text-stock-up' : isDown ? 'text-stock-down' : 'text-fluid-text',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={priceClasses}>
      <span className={`price-value inline-block px-1 rounded ${getBreathClass()}`}>{formatPrice(price)}</span>
      {changePercent !== undefined && changePercent !== null && (
        <span className={`ml-1 text-sm ${isUp ? 'text-stock-up' : isDown ? 'text-stock-down' : 'text-gray-500'}`}>
          {isUp ? '+' : ''}{changePercent.toFixed(2)}%
        </span>
      )}
    </span>
  )
})

export default PriceDisplay
