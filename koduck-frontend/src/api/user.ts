import request from './request'

// 
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

// 
export interface UpdateProfileRequest {
  nickname?: string
  avatarUrl?: string
}

// 
export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

export const userApi = {
  // 
  getCurrentUser: (): Promise<UserDetail> => {
    return request.get<UserDetail>('/api/v1/users/me')
  },

  // 
  updateProfile: (data: UpdateProfileRequest): Promise<UserDetail> => {
    return request.put<UserDetail>('/api/v1/users/me', data)
  },

  // 
  changePassword: (data: ChangePasswordRequest): Promise<void> => {
    return request.put<void>('/api/v1/users/me/password', data)
  },

  // 
  uploadAvatar: (file: File): Promise<string> => {
    // TODO:  API
    // const formData = new FormData()
    // formData.append('file', file)
    // return request.post<string>('/api/v1/users/me/avatar', formData)
    return Promise.resolve(URL.createObjectURL(file))
  },
}
