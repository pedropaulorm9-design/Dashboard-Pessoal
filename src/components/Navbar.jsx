import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Calendar, Wallet, BookOpen, Sun, Moon, Menu, X, LogOut, Settings } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const links = [
  { to: '/agenda', label: 'Agenda', icon: Calendar, accent: 'agenda' },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet, accent: 'financeiro' },
  { to: '/estudos', label: 'Estudos', icon: BookOpen, accent: 'estudos' },
];

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function renderLink(link, onClick) {
    const Icon = link.icon;
    return (
      <NavLink
        key={link.to}
        to={link.to}
        onClick={onClick}
        className={({ isActive }) => `nav-link ${link.accent} ${isActive ? `active ${link.accent}` : ''}`}
      >
        <Icon size={15} />
        {link.label}
      </NavLink>
    );
  }

  return (
    <>
      <header className="navbar">
        <div className="navbar-brand">
          <span>Painel — PP</span>
        </div>

        <nav className="navbar-links">{links.map((l) => renderLink(l))}</nav>

        <div className="navbar-actions">
          <button className="icon-btn" onClick={toggleTheme} aria-label="Alternar tema claro/escuro">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <NavLink
            to="/configuracoes"
            className={({ isActive }) => `icon-btn settings-link ${isActive ? 'active' : ''}`}
            aria-label="Configurações"
          >
            <Settings size={16} />
          </NavLink>
          <button className="text-btn" onClick={handleLogout}>
            Sair
          </button>
          <button
            className="icon-btn hamburger-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        {links.map((l) => renderLink(l, () => setMenuOpen(false)))}
        <NavLink
          to="/configuracoes"
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Settings size={15} />
          Configurações
        </NavLink>
        <button
          className="nav-link"
          onClick={() => {
            setMenuOpen(false);
            handleLogout();
          }}
        >
          <LogOut size={15} />
          Sair
        </button>
      </div>
    </>
  );
}
