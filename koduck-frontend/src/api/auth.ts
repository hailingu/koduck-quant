import request from './request'
import { ApiResponse } from '@/types'

export interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
}

export interface RegisterRequest {
  username: string
  password: string
  confirmPassword: string
  email?: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
}

export interface UserInfo {
  id: number
  username: string
  email?: string
  roles: string[]
}

export const authApi = {
  login: (data: LoginRequest) =>
    request.post<ApiResponse<LoginResponse>>('/api/auth/login', data),

  register: (data: RegisterRequest) =>
    request.post<ApiResponse<void>>('/api/auth/register', data),

  logout: () => request.post<ApiResponse<void>>('/api/auth/logout'),

  getUserInfo: () => request.get<ApiResponse<UserInfo>>('/api/auth/info'),

  refreshToken: (refreshToken: string) =>
    request.post<ApiResponse<LoginResponse>>('/api/auth/refresh', { refreshToken }),
}
