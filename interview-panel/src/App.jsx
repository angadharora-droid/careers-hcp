import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Tabs from './components/Tabs';
import Login from './pages/Login';
import Assignments from './pages/Assignments';
import ScoreCandidate from './pages/ScoreCandidate';
import PanelComparison from './pages/PanelComparison';
import Framework from './pages/Framework';

function Shell() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Tabs />
      <main className="flex-1 w-full max-w-[1180px] mx-auto px-4 sm:px-6 py-4">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Shell />}>
        <Route path="/" element={<Assignments />} />
        <Route path="/score/:applicationId" element={<ScoreCandidate />} />
        <Route path="/compare" element={<PanelComparison />} />
        <Route path="/framework" element={<Framework />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
