// import request from './request'

// 用户详情
export interface UserDetail {
  id: number
  username: string
  email: string
  nickname: string
  avatar: string | null
  phone: string | null
  createdAt: string
  updatedAt: string
}

// 更新资料请求
export interface UpdateProfileRequest {
  nickname?: string
  email?: string
  phone?: string
  avatar?: string
}

// 修改密码请求
export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

// Mock 数据 - 开发时使用
const mockUser: UserDetail = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  nickname: '测试用户',
  avatar: null,
  phone: '13800138000',
  createdAt: '2025-01-15T08:30:00',
  updatedAt: '2025-03-01T10:20:00',
}

export const userApi = {
  // 获取当前用户信息
  getCurrentUser: (): Promise<UserDetail> => {
    // TODO: 替换为真实 API
    // return request.get<UserDetail>('/api/v1/users/me')
    return Promise.resolve(mockUser)
  },

  // 更新用户资料
  updateProfile: (data: UpdateProfileRequest): Promise<UserDetail> => {
    // TODO: 替换为真实 API
    // return request.put<UserDetail>('/api/v1/users/me', data)
    return Promise.resolve({ ...mockUser, ...data })
  },

  // 修改密码
  changePassword: (data: ChangePasswordRequest): Promise<void> => {
    // TODO: 替换为真实 API
    // return request.put<void>('/api/v1/users/me/password', data)
    if (data.newPassword !== data.confirmPassword) {
      return Promise.reject(new Error('两次输入的密码不一致'))
    }
    return Promise.resolve()
  },

  // 上传头像
  uploadAvatar: (file: File): Promise<string> => {
    // TODO: 替换为真实 API
    // const formData = new FormData()
    // formData.append('file', file)
    // return request.post<string>('/api/v1/users/me/avatar', formData)
    return Promise.resolve(URL.createObjectURL(file))
  },
}
