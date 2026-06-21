import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Agenda from './pages/Agenda';
import Financeiro from './pages/Financeiro';
import Estudos from './pages/Estudos';
import Configuracoes from './pages/Configuracoes';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/estudos" element={<Estudos />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
            </Route>

            <Route path="/" element={<Navigate to="/agenda" replace />} />
            <Route path="*" element={<Navigate to="/agenda" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

function LoginPage() {
  return (
    <div className="app-shell">
      <Login />
    </div>
  );
}
