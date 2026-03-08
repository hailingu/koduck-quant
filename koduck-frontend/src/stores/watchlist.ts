import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import request from '@/api/request'

export interface WatchlistItem {
  id: number
  symbol: string
  name: string
  market: string
  price?: number
  changePercent?: number
}

interface WatchlistState {
  items: WatchlistItem[]
  isLoading: boolean
  error: string | null
  fetchWatchlist: () => Promise<void>
  addItem: (symbol: string, name: string, market: string) => Promise<void>
  removeItem: (id: number) => Promise<void>
  isInWatchlist: (symbol: string) => boolean
}

// API 响应类型
interface WatchlistApiItem {
  id: number
  symbol: string
  name: string
  market: string
  price?: number
  changePercent?: number
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      error: null,

      // 获取自选股列表
      fetchWatchlist: async () => {
        set({ isLoading: true, error: null })
        try {
          const data = await request.get<WatchlistApiItem[]>('/api/v1/watchlist')
          set({ items: data || [], isLoading: false })
        } catch (error) {
          console.error('Failed to fetch watchlist:', error)
          set({ error: '获取自选股失败', isLoading: false })
        }
      },

      // 添加自选股
      addItem: async (symbol: string, name: string, market: string) => {
        set({ isLoading: true, error: null })
        try {
          const newItem = await request.post<WatchlistApiItem>('/api/v1/watchlist', {
            symbol,
            name,
            market,
          })
          set((state) => ({ 
            items: [...state.items, newItem],
            isLoading: false 
          }))
        } catch (error) {
          console.error('Failed to add to watchlist:', error)
          set({ error: '添加自选股失败', isLoading: false })
          throw error
        }
      },

      // 删除自选股
      removeItem: async (id: number) => {
        set({ isLoading: true, error: null })
        try {
          await request.delete(`/api/v1/watchlist/${id}`)
          set((state) => ({ 
            items: state.items.filter((item) => item.id !== id),
            isLoading: false 
          }))
        } catch (error) {
          console.error('Failed to remove from watchlist:', error)
          set({ error: '删除自选股失败', isLoading: false })
          throw error
        }
      },

      isInWatchlist: (symbol: string) => {
        return get().items.some((item) => item.symbol === symbol)
      },
    }),
    {
      name: 'watchlist-storage',
    }
  )
)
