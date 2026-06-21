import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function translateError(code) {
  const map = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-not-found': 'Não existe conta com esse e-mail.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  };
  return map[code] || 'Algo deu errado. Tente novamente.';
}

export default function Login() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      navigate('/agenda');
    } catch (err) {
      setError(translateError(err.code));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div>
          <h1 className="auth-title">{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
          <p className="auth-sub">
            {mode === 'login'
              ? 'Acesse seu painel pessoal.'
              : 'Seus dados ficam sincronizados entre todos os seus dispositivos.'}
          </p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? 'Enviando...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>

        <div className="auth-toggle">
          {mode === 'login' ? (
            <>
              Ainda não tem conta?{' '}
              <button type="button" onClick={() => setMode('signup')}>
                Criar uma
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button type="button" onClick={() => setMode('login')}>
                Entrar
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
