import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  isDark: boolean
  themeMode: 'light' | 'dark' | 'auto'
  sidebarCollapsed: boolean
  toggleTheme: () => void
  setThemeMode: (mode: 'light' | 'dark' | 'auto') => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: false,
      themeMode: 'light',
      sidebarCollapsed: false,
      toggleTheme: () => set((state) => {
        const newIsDark = !state.isDark
        if (newIsDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        return { isDark: newIsDark, themeMode: newIsDark ? 'dark' : 'light' }
      }),
      setThemeMode: (mode) => set(() => {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        const nextIsDark = mode === 'auto' ? prefersDark : mode === 'dark'
        if (nextIsDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        return {
          themeMode: mode,
          isDark: nextIsDark,
        }
      }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        const mode = state?.themeMode || (state?.isDark ? 'dark' : 'light')
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        const shouldDark = mode === 'auto' ? prefersDark : mode === 'dark'
        if (shouldDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        if (state) {
          state.themeMode = mode
          state.isDark = shouldDark
        }
      },
    }
  )
)
