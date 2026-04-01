import request from './request'

export interface UserSettings {
  id: number
  userId: number
  theme: string
  language: string
  timezone: string
  llmConfig?: {
    provider?: string
    apiKey?: string
    apiBase?: string
    minimax?: {
      apiKey?: string
      apiBase?: string
    }
    deepseek?: {
      apiKey?: string
      apiBase?: string
    }
    openai?: {
      apiKey?: string
      apiBase?: string
    }
    memory?: {
      enabled?: boolean
      mode?: 'L0' | 'L1' | 'L2' | 'L3'
      enableL1?: boolean
      enableL2?: boolean
      enableL3?: boolean
    }
  }
}

export interface UpdateSettingsRequest {
  theme?: string
  language?: string
  timezone?: string
  llmConfig?: {
    provider?: string
    apiKey?: string
    apiBase?: string
    minimax?: {
      apiKey?: string
      apiBase?: string
    }
    deepseek?: {
      apiKey?: string
      apiBase?: string
    }
    openai?: {
      apiKey?: string
      apiBase?: string
    }
    memory?: {
      enabled?: boolean
      mode?: 'L0' | 'L1' | 'L2' | 'L3'
      enableL1?: boolean
      enableL2?: boolean
      enableL3?: boolean
    }
  }
}

export const settingsApi = {
  getSettings: (): Promise<UserSettings> => request.get<UserSettings>('/api/v1/settings'),
  updateSettings: (data: UpdateSettingsRequest): Promise<UserSettings> =>
    request.put<UserSettings>('/api/v1/settings', data),
}
