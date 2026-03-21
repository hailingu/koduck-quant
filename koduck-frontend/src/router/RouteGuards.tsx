import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

const LOGIN_PATH = '/login'
const MARKET_PATH = '/market'

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  if (isAuthenticated) {
    return <Outlet />
  }
  return <Navigate to={LOGIN_PATH} replace />
}

export function PublicRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  if (isAuthenticated) {
    return <Navigate to={MARKET_PATH} replace />
  }
  return <Outlet />
}
