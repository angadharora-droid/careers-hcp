import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RegisterPage from './pages/RegisterPage';
import ApplicationsPage from './pages/ApplicationsPage';
import RedFlagsPage from './pages/RedFlagsPage';
import FrameworkPage from './pages/FrameworkPage';
import InterviewersPage from './pages/InterviewersPage';

function AppRoutes() {
  const { token } = useAuth();
  if (!token) return <LoginPage />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="red-flags" element={<RedFlagsPage />} />
        <Route path="framework" element={<FrameworkPage />} />
        <Route path="interviewers" element={<InterviewersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
