import { Navigate, Outlet } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import Navbar from './Navbar';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const online = useOnlineStatus();

  if (loading) {
    return <div className="center-loading">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <Navbar />
      {!online && (
        <div className="offline-banner">
          <WifiOff size={13} />
          Modo offline — mostrando dados salvos. Vai sincronizar quando a internet voltar.
        </div>
      )}
      <Outlet />
    </div>
  );
}
