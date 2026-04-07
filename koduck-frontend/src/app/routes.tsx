import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { KoduckAi } from "./components/KoduckAi";
import { PortfolioPage } from "./components/PortfolioPage";
import { KLinePage } from "./components/KLinePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout><KoduckAi /></Layout>,
  },
  {
    path: "/portfolio",
    element: <Layout><PortfolioPage /></Layout>,
  },
  {
    path: "/kline",
    element: <Layout><KLinePage /></Layout>,
  },
  {
    path: "/flows",
    element: <Layout><div className="flex-1 flex items-center justify-center text-gray-500">Flows page coming soon</div></Layout>,
  },
  {
    path: "/pools",
    element: <Layout><div className="flex-1 flex items-center justify-center text-gray-500">Pools page coming soon</div></Layout>,
  },
  {
    path: "/history",
    element: <Layout><div className="flex-1 flex items-center justify-center text-gray-500">History page coming soon</div></Layout>,
  },
]);