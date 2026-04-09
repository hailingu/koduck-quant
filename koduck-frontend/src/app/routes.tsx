import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { PortfolioPage } from "./components/PortfolioPage";
import { KLinePage } from "./components/KLinePage";
import { LoginPage } from "./components/LoginPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { isAuthenticated } from "./auth";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: isAuthenticated() ? <Navigate to="/portfolio" replace /> : <LoginPage />,
  },
  {
    path: "/",
    element: <Navigate to={isAuthenticated() ? "/portfolio" : "/login"} replace />,
  },
  {
    path: "/portfolio",
    element: (
      <ProtectedRoute>
        <Layout><PortfolioPage /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/kline",
    element: (
      <ProtectedRoute>
        <Layout><KLinePage /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/flows",
    element: (
      <ProtectedRoute>
        <Layout><div className="flex-1 flex items-center justify-center text-gray-500">Flows page coming soon</div></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/pools",
    element: (
      <ProtectedRoute>
        <Layout><div className="flex-1 flex items-center justify-center text-gray-500">Pools page coming soon</div></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/history",
    element: (
      <ProtectedRoute>
        <Layout><div className="flex-1 flex items-center justify-center text-gray-500">History page coming soon</div></Layout>
      </ProtectedRoute>
    ),
  },
]);
