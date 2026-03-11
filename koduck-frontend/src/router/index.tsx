import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import MainLayout from '@/layouts/MainLayout'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Watchlist from '@/pages/Watchlist'
import Portfolio from '@/pages/Portfolio'
import Settings from '@/pages/Settings'
import Kline from '@/pages/Kline'
import Market from '@/pages/Market'

// Protected Route wrapper
function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

// Public Route wrapper (redirect to market if authenticated)
function PublicRoute() {
  const { isAuthenticated } = useAuthStore()
  return !isAuthenticated ? <Outlet /> : <Navigate to="/market" replace />
}

export const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/register', element: <Register /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: '/dashboard', element: <Navigate to="/market" replace /> },
          { path: '/market', element: <Market /> },
          { path: '/watchlist', element: <Watchlist /> },
          { path: '/kline', element: <Kline /> },
          { path: '/portfolio', element: <Portfolio /> },
          { path: '/settings', element: <Settings /> },
          { path: '/monitoring', element: <Navigate to="/market" replace /> },
          { path: '/profile', element: <Navigate to="/settings" replace /> },
          { path: '/profile/edit', element: <Navigate to="/settings" replace /> },
          { path: '/profile/preferences', element: <Navigate to="/settings" replace /> },
          { path: '/profile/security', element: <Navigate to="/settings" replace /> },
          { path: '/profile/api', element: <Navigate to="/settings" replace /> },
          { path: '/profile/data', element: <Navigate to="/settings" replace /> },
        ],
      },
    ],
  },
  {
    path: '/',
    element: <Navigate to="/market" replace />,
  },
])
