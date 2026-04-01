import request from './request'

export interface WatchlistItem {
  id: number
  market: string
  symbol: string
  name: string
  notes: string | null
  sortOrder: number
  createdAt: string
  // （null）
  price?: number
  change?: number
  changePercent?: number
}

export interface AddWatchlistRequest {
  market: string
  symbol: string
  name: string
  notes?: string
}

export const watchlistApi = {
  // 
  getWatchlist: () => request.get<WatchlistItem[]>('/api/v1/watchlist'),

  // 
  addToWatchlist: (data: AddWatchlistRequest) =>
    request.post<WatchlistItem>('/api/v1/watchlist', data),

  // 
  removeFromWatchlist: (id: number) =>
    request.delete<void>(`/api/v1/watchlist/${id}`),

  // 
  updateSortOrder: (id: number, sortOrder: number) =>
    request.patch<WatchlistItem>(`/api/v1/watchlist/${id}/sort`, { sortOrder }),

  // 
  sortWatchlist: (items: { id: number; sortOrder: number }[]) =>
    request.put<void>('/api/v1/watchlist/sort', { items }),

  // 
  updateNotes: (id: number, notes: string) =>
    request.put<WatchlistItem>(`/api/v1/watchlist/${id}/notes`, notes),
}
