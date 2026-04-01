import request from './request'

// 
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

// 
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

// 
export interface StrategyVersion {
  id: number
  versionNumber: number
  code: string
  changelog: string
  isActive: boolean
  createdAt: string
}

// 
export interface CreateStrategyRequest {
  name: string
  description?: string
  code?: string
  parameters?: StrategyParameterRequest[]
}

// 
export interface UpdateStrategyRequest {
  name?: string
  description?: string
  code?: string
  changelog?: string
  parameters?: StrategyParameterRequest[]
}

// 
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
  // 
  getStrategies: (): Promise<Strategy[]> => {
    return request.get<Strategy[]>('/api/v1/strategies')
  },

  // 
  getStrategy: (id: number): Promise<Strategy> => {
    return request.get<Strategy>(`/api/v1/strategies/${id}`)
  },

  // 
  createStrategy: (data: CreateStrategyRequest): Promise<Strategy> => {
    return request.post<Strategy>('/api/v1/strategies', data)
  },

  // 
  updateStrategy: (id: number, data: UpdateStrategyRequest): Promise<Strategy> => {
    return request.put<Strategy>(`/api/v1/strategies/${id}`, data)
  },

  // 
  deleteStrategy: (id: number): Promise<void> => {
    return request.delete<void>(`/api/v1/strategies/${id}`)
  },

  // 
  publishStrategy: (id: number): Promise<Strategy> => {
    return request.post<Strategy>(`/api/v1/strategies/${id}/publish`, {})
  },

  // 
  disableStrategy: (id: number): Promise<Strategy> => {
    return request.post<Strategy>(`/api/v1/strategies/${id}/disable`, {})
  },

  // 
  getVersions: (id: number): Promise<StrategyVersion[]> => {
    return request.get<StrategyVersion[]>(`/api/v1/strategies/${id}/versions`)
  },

  // 
  getVersion: (id: number, versionNumber: number): Promise<StrategyVersion> => {
    return request.get<StrategyVersion>(`/api/v1/strategies/${id}/versions/${versionNumber}`)
  },

  // 
  activateVersion: (id: number, versionId: number): Promise<StrategyVersion> => {
    return request.post<StrategyVersion>(`/api/v1/strategies/${id}/versions/${versionId}/activate`, {})
  },
}
