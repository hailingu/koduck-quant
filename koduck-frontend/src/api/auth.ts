import request from './request'

export interface LoginRequest {
  username: string
  password: string
  turnstileToken?: string
}

export interface UserInfo {
  id: number
  username: string
  email: string
  nickname: string
  avatarUrl: string | null
  status: string
  emailVerifiedAt: string | null
  lastLoginAt: string | null
  roles: string[]
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
  user: UserInfo
}

export interface RegisterRequest {
  username: string
  password: string
  email: string
  nickname?: string
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export const authApi = {
  /**
   * 用户登录
   */
  login: (data: LoginRequest): Promise<TokenResponse> => {
    return request.post<TokenResponse>('/api/v1/auth/login', data)
  },

  /**
   * 用户注册
   */
  register: (data: RegisterRequest): Promise<TokenResponse> => {
    return request.post<TokenResponse>('/api/v1/auth/register', data)
  },

  /**
   * 刷新 Token
   */
  refreshToken: (data: RefreshTokenRequest): Promise<TokenResponse> => {
    return request.post<TokenResponse>('/api/v1/auth/refresh', data)
  },

  /**
   * 用户登出
   */
  logout: (refreshToken?: string): Promise<void> => {
    return request.post<void>('/api/v1/auth/logout', refreshToken ? { refreshToken } : undefined)
  },

  /**
   * 获取安全配置
   */
  getSecurityConfig: (): Promise<{ enableCaptcha: boolean }> => {
    return request.get<{ enableCaptcha: boolean }>('/api/v1/auth/security-config')
  },
}
