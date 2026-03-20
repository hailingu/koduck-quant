import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, type UserInfo } from '@/api/auth'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserInfo | null
  isAuthenticated: boolean
  expiresIn: number | null
  login: (credentials: { username: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      expiresIn: null,

      /**
       * 用户登录
       */
      login: async (credentials) => {
        try {
          const response = await authApi.login(credentials)
          
          set({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            user: response.user,
            isAuthenticated: true,
            expiresIn: response.expiresIn,
          })
        } catch (error) {
          // 登录失败，抛出错误让调用方处理
          throw error
        }
      },

      /**
       * 用户登出
       */
      logout: async () => {
        const { refreshToken } = get()
        
        try {
          // 调用后端登出接口
          if (refreshToken) {
            await authApi.logout(refreshToken)
          }
        } catch (error) {
          // 即使后端调用失败，也清除本地状态
          console.error('Logout API error:', error)
        } finally {
          // 清除所有状态
          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            isAuthenticated: false,
            expiresIn: null,
          })
        }
      },

      /**
       * 刷新 Access Token
       */
      refreshAccessToken: async () => {
        const { refreshToken } = get()
        
        if (!refreshToken) {
          return false
        }

        try {
          const response = await authApi.refreshToken({ refreshToken })
          
          set({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            user: response.user,
            isAuthenticated: true,
            expiresIn: response.expiresIn,
          })
          
          return true
        } catch (error) {
          // 刷新失败，清除登录状态
          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            isAuthenticated: false,
            expiresIn: null,
          })
          return false
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        expiresIn: state.expiresIn,
      }),
    }
  )
)
