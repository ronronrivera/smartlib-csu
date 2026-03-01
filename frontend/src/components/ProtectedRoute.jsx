// Purpose: Route gate to protect restricted pages from unauthenticated users.
// Parts: auth check, redirect behavior.
import { Navigate } from "react-router-dom";
import { useStore } from "../store/useAuthStore";

const ProtectedRoute = ({ children, role }) => {
  const { user } = useStore();

  // Block anonymous users from protected pages.
  if (!user) return <Navigate to="/login" replace />;

  // Block authenticated users that don't match the required role.
  // Optional chaining prevents runtime crash if user shape is unexpectedly incomplete.
  if (role && user?.role !== role) return <Navigate to="/" replace />;

  // Auth + role checks passed.
  return children;
};

export default ProtectedRoute;
