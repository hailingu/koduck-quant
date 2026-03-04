import request from './request'

// 策略
export interface Strategy {
  id: number
  name: string
  description: string
  status: 'DRAFT' | 'PUBLISHED' | 'DISABLED'
  currentVersion: number
  createdAt: string
  updatedAt: string
  parameters?: StrategyParameter[]
}

// 策略参数
export interface StrategyParameter {
  id: number
  paramName: string
  paramType: 'STRING' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'ENUM'
  defaultValue: string
  minValue?: number
  maxValue?: number
  description: string
  isRequired: boolean
  sortOrder: number
}

// 策略版本
export interface StrategyVersion {
  id: number
  versionNumber: number
  code: string
  changelog: string
  isActive: boolean
  createdAt: string
}

// 创建策略请求
export interface CreateStrategyRequest {
  name: string
  description?: string
  code?: string
  parameters?: StrategyParameterRequest[]
}

// 更新策略请求
export interface UpdateStrategyRequest {
  name?: string
  description?: string
  code?: string
  changelog?: string
  parameters?: StrategyParameterRequest[]
}

// 策略参数请求
export interface StrategyParameterRequest {
  id?: number
  paramName: string
  paramType: 'STRING' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'ENUM'
  defaultValue?: string
  minValue?: number
  maxValue?: number
  description?: string
  isRequired?: boolean
  sortOrder?: number
}

export const strategyApi = {
  // 获取策略列表
  getStrategies: (): Promise<Strategy[]> => {
    return request.get<Strategy[]>('/api/v1/strategies')
  },

  // 获取策略详情
  getStrategy: (id: number): Promise<Strategy> => {
    return request.get<Strategy>(`/api/v1/strategies/${id}`)
  },

  // 创建策略
  createStrategy: (data: CreateStrategyRequest): Promise<Strategy> => {
    return request.post<Strategy>('/api/v1/strategies', data)
  },

  // 更新策略
  updateStrategy: (id: number, data: UpdateStrategyRequest): Promise<Strategy> => {
    return request.put<Strategy>(`/api/v1/strategies/${id}`, data)
  },

  // 删除策略
  deleteStrategy: (id: number): Promise<void> => {
    return request.delete<void>(`/api/v1/strategies/${id}`)
  },

  // 发布策略
  publishStrategy: (id: number): Promise<Strategy> => {
    return request.post<Strategy>(`/api/v1/strategies/${id}/publish`, {})
  },

  // 停用策略
  disableStrategy: (id: number): Promise<Strategy> => {
    return request.post<Strategy>(`/api/v1/strategies/${id}/disable`, {})
  },

  // 获取策略版本列表
  getVersions: (id: number): Promise<StrategyVersion[]> => {
    return request.get<StrategyVersion[]>(`/api/v1/strategies/${id}/versions`)
  },

  // 获取指定版本
  getVersion: (id: number, versionNumber: number): Promise<StrategyVersion> => {
    return request.get<StrategyVersion>(`/api/v1/strategies/${id}/versions/${versionNumber}`)
  },

  // 激活指定版本
  activateVersion: (id: number, versionId: number): Promise<StrategyVersion> => {
    return request.post<StrategyVersion>(`/api/v1/strategies/${id}/versions/${versionId}/activate`, {})
  },
}
