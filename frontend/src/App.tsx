import { Navigate, Route, Routes } from "react-router-dom";
import { useMemo } from "react";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PredictionPage from "./pages/PredictionPage";
import HistoryPage from "./pages/HistoryPage";
import MachinesPage from "./pages/MachinesPage";
import Layout from "./components/Layout";

const getToken = () => !!localStorage.getItem("token");

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const isLoggedIn = useMemo(() => getToken(), []);

  return (
    <Routes>
      <Route path="/login" element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="predict" element={<PredictionPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="machines" element={<MachinesPage />} />
        <Route index element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
