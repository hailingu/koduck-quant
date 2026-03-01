import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import MainLayout from '@/layouts/MainLayout'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/Dashboard'
import Watchlist from '@/pages/Watchlist'
import Kline from '@/pages/Kline'

// Protected Route wrapper
function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

// Public Route wrapper (redirect to dashboard if authenticated)
function PublicRoute() {
  const { isAuthenticated } = useAuthStore()
  return !isAuthenticated ? <Outlet /> : <Navigate to="/dashboard" replace />
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
          { path: '/dashboard', element: <Dashboard /> },
          { path: '/market', element: <div className="text-gray-900 dark:text-white">市场行情 (开发中)</div> },
          { path: '/watchlist', element: <Watchlist /> },
          { path: '/kline', element: <Kline /> },
          { path: '/portfolio', element: <div className="text-gray-900 dark:text-white">投资组合 (开发中)</div> },
          { path: '/settings', element: <div className="text-gray-900 dark:text-white">设置 (开发中)</div> },
        ],
      },
    ],
  },
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
])
