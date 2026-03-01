import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import type { ApiResponse } from '@/types'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

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
    if (apiResponse.code !== 200 && apiResponse.code !== 0) {
      return Promise.reject(new Error(apiResponse.message))
    }
    return apiResponse.data as unknown as AxiosResponse<unknown>
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
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
