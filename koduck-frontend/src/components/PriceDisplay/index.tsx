import { useEffect, useState, useRef, memo } from 'react'
import { isTradingHours, getMarketStatus } from '@/utils/trading'

export interface PriceDisplayProps {
  /** 当前价格 */
  price: number | null
  /** 昨收价 */
  prevClose?: number | null
  /** 涨跌额 */
  change?: number | null
  /** 涨跌幅 */
  changePercent?: number | null
  /** 是否实时更新（启用呼吸动画） */
  isRealTime?: boolean
  /** 自定义样式类名 */
  className?: string
  /** 是否显示标签（如"昨收"） */
  showLabel?: boolean
  /** 价格精度 */
  decimals?: number
}

/**
 * 价格显示组件
 * - 交易时间内：根据涨跌显示绿色/红色呼吸动画
 * - 非交易时间：显示灰色静态昨收价格
 */
export const PriceDisplay = memo(function PriceDisplay({
  price,
  prevClose,
  change,
  changePercent,
  isRealTime = false,
  className = '',
  showLabel = false,
  decimals = 2,
}: PriceDisplayProps) {
  const [isBreathing, setIsBreathing] = useState(false)
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null)
  const prevPriceRef = useRef<number | null>(null)

  // 检测交易时间
  const trading = isTradingHours()
  const marketStatus = getMarketStatus()
  const isTradingTime = trading || marketStatus === 'pre-market'

  // 判断涨跌方向
  const priceValue = price ?? 0
  const prevCloseValue = prevClose ?? 0
  const isUp = (changePercent ?? 0) >= 0

  // 价格变动检测：触发呼吸动画和闪烁效果
  useEffect(() => {
    if (!isRealTime || !isTradingTime || price === null || prevPriceRef.current === null) {
      prevPriceRef.current = price
      return
    }

    const prevPrice = prevPriceRef.current
    if (price !== prevPrice && price !== null) {
      // 价格发生变动
      const direction = price > prevPrice ? 'up' : 'down'

      // 触发短暂闪烁效果
      setPriceFlash(direction)
      const flashTimer = setTimeout(() => setPriceFlash(null), 500)

      // 触发呼吸动画（价格变动时开始，稳定3秒后停止）
      setIsBreathing(true)
      const breathingTimer = setTimeout(() => setIsBreathing(false), 3000)

      prevPriceRef.current = price

      return () => {
        clearTimeout(flashTimer)
        clearTimeout(breathingTimer)
      }
    }
    prevPriceRef.current = price
  }, [price, isRealTime, isTradingTime])

  // 格式化价格
  const formatPrice = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '--'
    }
    return value.toFixed(decimals)
  }

  // 渲染交易时间价格
  if (isTradingTime) {
    const priceClasses = [
      'price-display',
      isBreathing && 'price-breathing',
      isUp ? 'price-up' : 'price-down',
      priceFlash === 'up' && 'price-flash-up',
      priceFlash === 'down' && 'price-flash-down',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <span className={priceClasses}>
        <span className="price-value">{formatPrice(price)}</span>
        {changePercent !== undefined && changePercent !== null && (
          <span className={`price-change ml-1 text-sm ${isUp ? 'text-stock-up' : 'text-stock-down'}`}>
            {isUp ? '↑' : '↓'} {Math.abs(changePercent).toFixed(2)}%
          </span>
        )}
      </span>
    )
  }

  // 非交易时间：显示昨收价格（灰色静态）
  return (
    <span className={`price-display price-closed ${className}`}>
      <span className="price-value">{formatPrice(prevClose ?? price)}</span>
      {showLabel && (
        <span className="price-label ml-1 text-xs opacity-75">昨收</span>
      )}
    </span>
  )
})

export default PriceDisplay
