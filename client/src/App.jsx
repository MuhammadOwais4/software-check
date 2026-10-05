import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext/AuthContext";
import Login from "./pages/Login/Login";
import AdminDashboard from "./pages/Dashboard/Admin/Admindashboard";
import DeveloperDashboard from "./pages/Dashboard/Developer/Developerdashboard";
import UserDashboard from "./pages/Dashboard/User/Userdashboard";

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#06090f", gap: 16,
    }}>
      <div style={{
        width: 44, height: 44,
        border: "4px solid rgba(6,182,212,0.2)",
        borderTopColor: "#06b6d4",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <p style={{ color: "#475569", fontSize: 11, letterSpacing: 3, textTransform: "uppercase" }}>
        Loading...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const roleMap = {
      admin:     "/dashboard/admin",
      developer: "/dashboard/developer",
      user:      "/dashboard/user",
    };
    return <Navigate to={roleMap[user.role] || "/login"} replace />;
  }
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  const roleMap = {
    admin:     "/dashboard/admin",
    developer: "/dashboard/developer",
    user:      "/dashboard/user",
  };
  return <Navigate to={roleMap[user.role] || "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />
          <Route
            path="/dashboard/admin/*"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/developer/*"
            element={
              <ProtectedRoute allowedRoles={["developer"]}>
                <DeveloperDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/user/*"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}