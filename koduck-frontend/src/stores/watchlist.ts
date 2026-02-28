import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WatchlistItem {
  id: number
  symbol: string
  name: string
  market: string
}

interface WatchlistState {
  items: WatchlistItem[]
  addItem: (symbol: string, name: string, market: string) => Promise<void>
  removeItem: (id: number) => void
  isInWatchlist: (symbol: string) => boolean
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: async (symbol: string, name: string, market: string) => {
        // TODO: Call API to add to watchlist
        // For now, just add to local state
        const newItem: WatchlistItem = {
          id: Date.now(),
          symbol,
          name,
          market,
        }
        set((state) => ({ items: [...state.items, newItem] }))
      },
      
      removeItem: (id: number) => {
        set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
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
