// Global type definitions

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface User {
  id: number
  username: string
  email?: string
  roles: string[]
}
