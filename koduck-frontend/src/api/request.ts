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
    //  Zustand persist  token
    const authStorage = localStorage.getItem('auth-storage')
    if (authStorage) {
      try {
        const authState = JSON.parse(authStorage)
        if (authState.state?.accessToken) {
          config.headers.Authorization = `Bearer ${authState.state.accessToken}`
        }
      } catch (e) {
        // ，
      }
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
    
    // ：0  200 
    if (apiResponse.code !== 0 && apiResponse.code !== 200) {
      return Promise.reject(new Error(apiResponse.message || '请求失败'))
    }
    
    //  snake_case  camelCase
    const camelData = keysToCamelCase(apiResponse.data)
    
    return camelData as unknown as AxiosResponse<unknown>
  },
  (error) => {
    //  HTTP 
    if (error.response) {
      const status = error.response.status
      const message = error.response.data?.message || error.message
      
      // 401 ， token 
      if (status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('auth-storage')
        window.location.href = '/login'
      }
      
      return Promise.reject(new Error(message))
    }
    
    // 
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
