/**
 * A股交易时间检测工具
 * 用于判断当前是否处于交易时间，从而决定是否显示价格呼吸动画
 */

/**
 * 判断当前是否为A股交易时间（北京时间）
 * A股交易时间：09:30-11:30, 13:00-15:00
 * @returns boolean - true 表示当前处于交易时间
 */
export function isTradingHours(): boolean {
  // 获取北京时间（UTC+8）
  const now = new Date()
  const beijingTime = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000)
  const day = beijingTime.getDay()

  // 周末不交易（0=周日，6=周六）
  if (day === 0 || day === 6) {
    return false
  }

  const hour = beijingTime.getHours()
  const minute = beijingTime.getMinutes()
  const time = hour * 60 + minute

  // 上午：09:30 - 11:30
  const morningStart = 9 * 60 + 30 // 570
  const morningEnd = 11 * 60 + 30 // 690

  // 下午：13:00 - 15:00
  const afternoonStart = 13 * 60 // 780
  const afternoonEnd = 15 * 60 // 900

  return (time >= morningStart && time <= morningEnd) || (time >= afternoonStart && time <= afternoonEnd)
}

/**
 * 获取当前市场状态
 */
export type MarketStatus = 'trading' | 'closed' | 'pre-market' | 'after-hours'

export function getMarketStatus(): MarketStatus {
  const now = new Date()
  const day = now.getDay()

  // 周末休市
  if (day === 0 || day === 6) {
    return 'closed'
  }

  const hour = now.getHours()
  const minute = now.getMinutes()
  const time = hour * 60 + minute

  // 集合竞价：09:15 - 09:30
  const preMarketStart = 9 * 60 + 15 // 555
  const morningStart = 9 * 60 + 30 // 570

  // 上午交易：09:30 - 11:30
  const morningEnd = 11 * 60 + 30 // 690

  // 午休：11:30 - 13:00
  const afternoonStart = 13 * 60 // 780

  // 下午交易：13:00 - 15:00
  const afternoonEnd = 15 * 60 // 900

  // 盘后固定价格委托：15:00 - 15:05
  const afterHoursEnd = 15 * 60 + 5 // 905

  if (time >= preMarketStart && time < morningStart) {
    return 'pre-market'
  }

  if (time >= morningStart && time <= morningEnd) {
    return 'trading'
  }

  if (time >= afternoonStart && time <= afternoonEnd) {
    return 'trading'
  }

  if (time > afternoonEnd && time <= afterHoursEnd) {
    return 'after-hours'
  }

  return 'closed'
}
