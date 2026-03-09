import { memo } from 'react'
import { isTradingHours } from '@/utils/trading'

export interface PriceDisplayProps {
  /** 当前价格 */
  price: number | null
  /** 昨收价 */
  prevClose?: number | null
  /** 涨跌额 */
  change?: number | null
  /** 涨跌幅 */
  changePercent?: number | null
  /** 自定义样式类名 */
  className?: string
  /** 是否显示标签（如"昨收"） */
  showLabel?: boolean
  /** 价格精度 */
  decimals?: number
  /** 显示模式：compact=紧凑，full=完整 */
  mode?: 'compact' | 'full'
}

/**
 * 价格显示组件（东方财富风格）
 * - 交易时间内：根据涨跌显示绿色/红色
 * - 非交易时间：显示灰色静态价格
 * - 支持显示涨跌额和涨跌幅
 */
export const PriceDisplay = memo(function PriceDisplay({
  price,
  prevClose,
  change,
  changePercent,
  className = '',
  showLabel = false,
  decimals = 2,
  mode = 'compact',
}: PriceDisplayProps) {
  // 检测交易时间
  const trading = isTradingHours()

  // 计算涨跌额（如果未提供）
  const calculatedChange = change ?? (price && prevClose ? price - prevClose : null)

  // 判断涨跌方向
  const isUp = (calculatedChange ?? 0) > 0
  const isDown = (calculatedChange ?? 0) < 0

  // 颜色类名（A股传统：红涨绿跌）
  const getColorClass = () => {
    if (isUp) return 'text-stock-up'
    if (isDown) return 'text-stock-down'
    return 'text-gray-600 dark:text-gray-400'
  }

  // 格式化价格
  const formatPrice = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '--'
    }
    return value.toFixed(decimals)
  }

  // 格式化涨跌额
  const formatChange = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '--'
    }
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(decimals)}`
  }

  // 格式化涨跌幅
  const formatChangePercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '--%'
    }
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  // 完整模式（东方财富风格）
  if (mode === 'full') {
    return (
      <div className={`flex items-baseline gap-3 ${className}`}>
        {/* 大号价格 */}
        <span className={`text-5xl font-bold tracking-tight ${getColorClass()}`}>
          {formatPrice(price)}
        </span>
        {/* 涨跌额和涨跌幅 */}
        <div className="flex items-center gap-2 text-lg">
          <span className={getColorClass()}>
            {formatChange(calculatedChange)}
          </span>
          <span className={getColorClass()}>
            {formatChangePercent(changePercent)}
          </span>
        </div>
        {showLabel && (
          <span className="ml-2 text-sm text-gray-500">
            {trading ? '交易中' : '已收盘'}
          </span>
        )}
      </div>
    )
  }

  // 紧凑模式（原逻辑，用于列表等场景）
  const priceClasses = [
    'price-display',
    isUp ? 'text-stock-up' : isDown ? 'text-stock-down' : 'text-gray-900 dark:text-white',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={priceClasses}>
      <span className="price-value">{formatPrice(price)}</span>
      {changePercent !== undefined && changePercent !== null && (
        <span className={`ml-1 text-sm ${isUp ? 'text-stock-up' : isDown ? 'text-stock-down' : 'text-gray-500'}`}>
          {isUp ? '+' : ''}{changePercent.toFixed(2)}%
        </span>
      )}
    </span>
  )
})

export default PriceDisplay
