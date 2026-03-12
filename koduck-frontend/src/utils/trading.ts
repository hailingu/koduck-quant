/**
 * A
 * ，
 */

/**
 * A（）
 * A：09:30-11:30, 13:00-15:00
 * @returns boolean - true 
 */
export function isTradingHours(): boolean {
  // （UTC+8）
  const now = new Date()
  const beijingTime = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000)
  const day = beijingTime.getDay()

  // （0=，6=）
  if (day === 0 || day === 6) {
    return false
  }

  const hour = beijingTime.getHours()
  const minute = beijingTime.getMinutes()
  const time = hour * 60 + minute

  // ：09:30 - 11:30
  const morningStart = 9 * 60 + 30 // 570
  const morningEnd = 11 * 60 + 30 // 690

  // ：13:00 - 15:00
  const afternoonStart = 13 * 60 // 780
  const afternoonEnd = 15 * 60 // 900

  return (time >= morningStart && time <= morningEnd) || (time >= afternoonStart && time <= afternoonEnd)
}

/**
 * 
 */
export type MarketStatus = 'trading' | 'closed' | 'pre-market' | 'after-hours'

export function getMarketStatus(): MarketStatus {
  const now = new Date()
  const day = now.getDay()

  // 
  if (day === 0 || day === 6) {
    return 'closed'
  }

  const hour = now.getHours()
  const minute = now.getMinutes()
  const time = hour * 60 + minute

  // ：09:15 - 09:30
  const preMarketStart = 9 * 60 + 15 // 555
  const morningStart = 9 * 60 + 30 // 570

  // ：09:30 - 11:30
  const morningEnd = 11 * 60 + 30 // 690

  // ：11:30 - 13:00
  const afternoonStart = 13 * 60 // 780

  // ：13:00 - 15:00
  const afternoonEnd = 15 * 60 // 900

  // ：15:00 - 15:05
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
