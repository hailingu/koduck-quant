import request from './request'

export interface WatchlistItem {
  id: number
  market: string
  symbol: string
  name: string
  note: string | null
  sortOrder: number
  createdAt: string
  // 实时数据（可能为null）
  price?: number
  change?: number
  changePercent?: number
}

export interface AddWatchlistRequest {
  market: string
  symbol: string
  name: string
  note?: string
}

export const watchlistApi = {
  // 获取自选股列表
  getWatchlist: () => request.get<WatchlistItem[]>('/api/v1/watchlist'),

  // 添加自选股
  addToWatchlist: (data: AddWatchlistRequest) =>
    request.post<WatchlistItem>('/api/v1/watchlist', data),

  // 删除自选股
  removeFromWatchlist: (id: number) =>
    request.delete<void>(`/api/v1/watchlist/${id}`),

  // 更新排序
  updateSortOrder: (id: number, sortOrder: number) =>
    request.patch<WatchlistItem>(`/api/v1/watchlist/${id}/sort`, { sortOrder }),
}
