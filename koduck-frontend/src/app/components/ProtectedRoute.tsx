import { Navigate, useLocation } from "react-router";
import { isAuthenticated } from "../auth";

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
