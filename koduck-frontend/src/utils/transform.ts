/**
 * 数据转换工具函数
 * 用于处理后端 snake_case 到前端 camelCase 的转换
 */

/**
 * 将 snake_case 字符串转换为 camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * 将 camelCase 字符串转换为 snake_case
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

/**
 * 递归转换对象的键名 (snake_case -> camelCase)
 */
export function keysToCamelCase<T>(obj: any): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => keysToCamelCase(item)) as unknown as T
  }

  const result: any = {}
  for (const key of Object.keys(obj)) {
    const camelKey = toCamelCase(key)
    const value = obj[key]
    
    // 递归转换嵌套对象
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // 检查是否为 Date 对象
      if (value instanceof Date) {
        result[camelKey] = value
      } else {
        result[camelKey] = keysToCamelCase(value)
      }
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map((item) => 
        item && typeof item === 'object' ? keysToCamelCase(item) : item
      )
    } else {
      result[camelKey] = value
    }
  }
  
  return result as T
}

/**
 * 递归转换对象的键名 (camelCase -> snake_case)
 */
export function keysToSnakeCase<T>(obj: any): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => keysToSnakeCase(item)) as unknown as T
  }

  const result: any = {}
  for (const key of Object.keys(obj)) {
    const snakeKey = toSnakeCase(key)
    const value = obj[key]
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[snakeKey] = keysToSnakeCase(value)
    } else if (Array.isArray(value)) {
      result[snakeKey] = value.map((item) => 
        item && typeof item === 'object' ? keysToSnakeCase(item) : item
      )
    } else {
      result[snakeKey] = value
    }
  }
  
  return result as T
}

/**
 * 格式化日期时间
 * 将后端时间戳或 ISO 字符串转换为本地化显示
 */
export function formatDateTime(value: string | number | Date): string {
  const date = new Date(value)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * 格式化日期
 */
export function formatDate(value: string | number | Date): string {
  const date = new Date(value)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
