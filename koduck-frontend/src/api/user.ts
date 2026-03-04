import request from './request'

// 用户详情
export interface UserDetail {
  id: number
  username: string
  email: string
  nickname: string
  avatarUrl: string | null
  status: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
  roles?: string[]
}

// 更新资料请求
export interface UpdateProfileRequest {
  nickname?: string
  avatarUrl?: string
}

// 修改密码请求
export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

export const userApi = {
  // 获取当前用户信息
  getCurrentUser: (): Promise<UserDetail> => {
    return request.get<UserDetail>('/api/v1/users/me')
  },

  // 更新用户资料
  updateProfile: (data: UpdateProfileRequest): Promise<UserDetail> => {
    return request.put<UserDetail>('/api/v1/users/me', data)
  },

  // 修改密码
  changePassword: (data: ChangePasswordRequest): Promise<void> => {
    return request.put<void>('/api/v1/users/me/password', data)
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
