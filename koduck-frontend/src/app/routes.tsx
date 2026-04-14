import { lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { isAuthenticated } from "./auth";

const KoduckAi = lazy(async () => {
  const module = await import("./components/KoduckAi");
  return { default: module.KoduckAi };
});

const PortfolioPage = lazy(async () => {
  const module = await import("./components/PortfolioPage");
  return { default: module.PortfolioPage };
});

const KLinePage = lazy(async () => {
  const module = await import("./components/KLinePage");
  return { default: module.KLinePage };
});

const LoginPage = lazy(async () => {
  const module = await import("./components/LoginPage");
  return { default: module.LoginPage };
});

function LoginRoute() {
  return isAuthenticated() ? <Navigate to="/koduck-ai" replace /> : <LoginPage />;
}

function HomeRoute() {
  return <Navigate to={isAuthenticated() ? "/koduck-ai" : "/login"} replace />;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginRoute />,
  },
  {
    path: "/",
    element: <HomeRoute />,
  },
  {
    path: "/koduck-ai",
    element: (
      <ProtectedRoute>
        <Layout>
          <KoduckAi />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/portfolio",
    element: (
      <ProtectedRoute>
        <Layout>
          <PortfolioPage />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/kline",
    element: (
      <ProtectedRoute>
        <Layout>
          <KLinePage />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/flows",
    element: (
      <ProtectedRoute>
        <Layout>
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Flows page coming soon
          </div>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/pools",
    element: (
      <ProtectedRoute>
        <Layout>
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Pools page coming soon
          </div>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/history",
    element: (
      <ProtectedRoute>
        <Layout>
          <div className="flex-1 flex items-center justify-center text-gray-500">
            History page coming soon
          </div>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "*",
    element: <HomeRoute />,
  },
]);
