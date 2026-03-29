import type { ReactElement } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Watchlist from '@/pages/Watchlist'
import Portfolio from '@/pages/Portfolio'
import Settings from '@/pages/Settings'
import Kline from '@/pages/Kline'
import Market from '@/pages/Market'
import Dashboard from '@/pages/Dashboard'
import FundFlowAnalysis from '@/pages/FundFlowAnalysis'
import SectorNetwork from '@/pages/SectorNetwork'
import AICommandCenter from '@/pages/AICommandCenter'
import Profile from '@/pages/Profile'
import { ProtectedRoute, PublicRoute } from './RouteGuards'

type AppRouteConfig = {
  readonly path: string
  readonly element: ReactElement
}

const LOGIN_PATH = '/login'
const MARKET_PATH = '/market'

const PUBLIC_ROUTES: ReadonlyArray<AppRouteConfig> = [
  { path: LOGIN_PATH, element: <Login /> },
  { path: '/register', element: <Register /> },
]

const PRIVATE_LAYOUT_ROUTES: ReadonlyArray<AppRouteConfig> = [
  { path: '/dashboard', element: <Dashboard /> },
  { path: MARKET_PATH, element: <Market /> },
  { path: '/fundflow', element: <FundFlowAnalysis /> },
  { path: '/sector', element: <SectorNetwork /> },
  { path: '/watchlist', element: <Watchlist /> },
  { path: '/kline', element: <Kline /> },
  { path: '/portfolio', element: <Portfolio /> },
  { path: '/ai', element: <AICommandCenter /> },
  { path: '/settings', element: <Settings /> },
  { path: '/profile', element: <Profile /> },
]

export const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: PUBLIC_ROUTES.map((route) => ({ path: route.path, element: route.element })),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: PRIVATE_LAYOUT_ROUTES.map((route) => ({ path: route.path, element: route.element })),
      },
    ],
  },
  {
    path: '/',
    element: <Navigate to={MARKET_PATH} replace />,
  },
])
