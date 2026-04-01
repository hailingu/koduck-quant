/**
 * 
 *  snake_case  camelCase 
 */

/**
 *  snake_case  camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 *  camelCase  snake_case
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

/**
 *  (snake_case -> camelCase)
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
    
    // 
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      //  Date 
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
 *  (camelCase -> snake_case)
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
 * 
 *  ISO 
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
 * 
 */
export function formatDate(value: string | number | Date): string {
  const date = new Date(value)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
