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
    qqBot?: {
      enabled?: boolean
      appId?: string
      clientSecret?: string
      apiBase?: string
      tokenPath?: string
      sendUrlTemplate?: string
      defaultTargetId?: string
      targetPlaceholder?: string
      contentField?: string
      msgType?: number
      tokenTtlBufferSeconds?: number
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
    qqBot?: {
      enabled?: boolean
      appId?: string
      clientSecret?: string
      apiBase?: string
      tokenPath?: string
      sendUrlTemplate?: string
      defaultTargetId?: string
      targetPlaceholder?: string
      contentField?: string
      msgType?: number
      tokenTtlBufferSeconds?: number
    }
  }
}

export const settingsApi = {
  getSettings: (): Promise<UserSettings> => request.get<UserSettings>('/api/v1/settings'),
  updateSettings: (data: UpdateSettingsRequest): Promise<UserSettings> =>
    request.put<UserSettings>('/api/v1/settings', data),
}
