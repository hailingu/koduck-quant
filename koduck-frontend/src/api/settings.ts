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
  }
}

export const settingsApi = {
  getSettings: (): Promise<UserSettings> => request.get<UserSettings>('/api/v1/settings'),
  updateSettings: (data: UpdateSettingsRequest): Promise<UserSettings> =>
    request.put<UserSettings>('/api/v1/settings', data),
}
