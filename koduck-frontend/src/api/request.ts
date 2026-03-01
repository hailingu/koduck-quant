import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import type { ApiResponse } from '@/types'
import { keysToCamelCase } from '@/utils/transform'

const baseURL = import.meta.env.VITE_API_BASE_URL || ''

const axiosInstance: AxiosInstance = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - extracts data from ApiResponse
axiosInstance.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>) => {
    const apiResponse = response.data
    
    // 统一处理响应码：0 或 200 都表示成功
    if (apiResponse.code !== 0 && apiResponse.code !== 200) {
      return Promise.reject(new Error(apiResponse.message || '请求失败'))
    }
    
    // 转换 snake_case 到 camelCase
    const camelData = keysToCamelCase(apiResponse.data)
    
    return camelData as unknown as AxiosResponse<unknown>
  },
  (error) => {
    // 处理 HTTP 错误状态
    if (error.response) {
      const status = error.response.status
      const message = error.response.data?.message || error.message
      
      // 401 未授权，清除 token 并跳转登录
      if (status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('auth-storage')
        window.location.href = '/login'
      }
      
      return Promise.reject(new Error(message))
    }
    
    // 网络错误
    if (error.request) {
      return Promise.reject(new Error('网络错误，请检查连接'))
    }
    
    return Promise.reject(error)
  }
)

// Wrapper that returns T directly (extracted from ApiResponse)
const request = {
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return axiosInstance.get(url, config) as Promise<T>
  },
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    return axiosInstance.post(url, data, config) as Promise<T>
  },
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    return axiosInstance.put(url, data, config) as Promise<T>
  },
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    return axiosInstance.patch(url, data, config) as Promise<T>
  },
  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return axiosInstance.delete(url, config) as Promise<T>
  },
}

export default request
