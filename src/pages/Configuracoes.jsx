import { useState } from 'react';
import { Settings, Download, AlertTriangle } from 'lucide-react';
import { collection, deleteDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { db } from '../firebase';

const COLLECTIONS = ['tasks', 'transactions', 'subjects'];

export default function Configuracoes() {
  const { user, updateDisplayName, changePassword, reauthenticate, deleteAccountWithPassword } = useAuth();
  const { preferences, updatePreferences } = useUserPreferences(user.uid);

  const [name, setName] = useState(user.displayName || '');
  const [nameMsg, setNameMsg] = useState('');

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  const [exporting, setExporting] = useState(false);

  const [dangerPassword, setDangerPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [dangerError, setDangerError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleSaveName() {
    setNameMsg('');
    await updateDisplayName(name.trim());
    setNameMsg('Nome atualizado.');
  }

  async function handleChangePassword() {
    setPwError('');
    setPwMsg('');
    if (pwForm.next.length < 6) {
      setPwError('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('As senhas não coincidem.');
      return;
    }
    try {
      await changePassword(pwForm.current, pwForm.next);
      setPwMsg('Senha alterada com sucesso.');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwError(
        err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? 'Senha atual incorreta.'
          : 'Não foi possível alterar a senha. Tente novamente.'
      );
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const data = {};
      for (const colName of COLLECTIONS) {
        const snap = await getDocs(collection(db, 'users', user.uid, colName));
        data[colName] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      const prefsSnap = await getDoc(doc(db, 'users', user.uid, 'meta', 'preferences'));
      const streakSnap = await getDoc(doc(db, 'users', user.uid, 'meta', 'studyStreak'));
      data.preferences = prefsSnap.exists() ? prefsSnap.data() : null;
      data.studyStreak = streakSnap.exists() ? streakSnap.data() : null;
      data.exportedAt = new Date().toISOString();

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `painel-pp-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setDangerError('');
    if (confirmText !== 'EXCLUIR') {
      setDangerError('Digite EXCLUIR para confirmar.');
      return;
    }
    if (!dangerPassword) {
      setDangerError('Digite sua senha atual.');
      return;
    }
    setDeleting(true);
    try {
      // Verifica a senha ANTES de apagar qualquer dado — assim, se a senha
      // estiver errada, nada é perdido.
      await reauthenticate(dangerPassword);

      for (const colName of COLLECTIONS) {
        const snap = await getDocs(collection(db, 'users', user.uid, colName));
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      }
      await deleteDoc(doc(db, 'users', user.uid, 'meta', 'preferences')).catch(() => {});
      await deleteDoc(doc(db, 'users', user.uid, 'meta', 'studyStreak')).catch(() => {});
      await deleteAccountWithPassword(dangerPassword);
    } catch (err) {
      setDeleting(false);
      setDangerError(
        err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? 'Senha incorreta.'
          : 'Não foi possível apagar a conta. Tente novamente.'
      );
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <Settings size={18} />
        <div>
          <span className="page-comment">// configurações</span>
          <h2 className="page-title">Configurações</h2>
        </div>
      </div>

      {/* Perfil */}
      <div className="card" style={{ marginBottom: 16 }}>
        <span className="settings-section-title">Perfil</span>

        <div className="settings-row">
          <label>Nome de exibição</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="settings-actions">
          <button className="btn btn-primary" onClick={handleSaveName}>
            Salvar nome
          </button>
          {nameMsg && <span className="settings-success">{nameMsg}</span>}
        </div>

        <hr className="settings-divider" />

        <div className="settings-row">
          <label>Senha atual</label>
          <input
            type="password"
            value={pwForm.current}
            onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
          />
        </div>
        <div className="settings-row">
          <label>Nova senha</label>
          <input
            type="password"
            value={pwForm.next}
            onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
          />
        </div>
        <div className="settings-row">
          <label>Confirmar nova senha</label>
          <input
            type="password"
            value={pwForm.confirm}
            onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
          />
        </div>
        {pwError && <span className="auth-error">{pwError}</span>}
        <div className="settings-actions">
          <button className="btn btn-primary" onClick={handleChangePassword}>
            Alterar senha
          </button>
          {pwMsg && <span className="settings-success">{pwMsg}</span>}
        </div>
      </div>

      {/* Preferências */}
      <div className="card" style={{ marginBottom: 16 }}>
        <span className="settings-section-title">Preferências</span>
        <div className="settings-row">
          <label>Gráfico padrão do Financeiro</label>
          <select
            value={preferences.chartType}
            onChange={(e) => updatePreferences({ chartType: e.target.value })}
          >
            <option value="pizza">Pizza</option>
            <option value="barra">Barra</option>
            <option value="linha">Linha (evolução do saldo)</option>
          </select>
        </div>
      </div>

      {/* Exportar dados */}
      <div className="card" style={{ marginBottom: 16 }}>
        <span className="settings-section-title">Seus dados</span>
        <p className="item-tag" style={{ margin: 0 }}>
          Baixa uma cópia de tudo (agenda, financeiro, estudos) num arquivo .json — útil como backup pessoal.
        </p>
        <div className="settings-actions">
          <button className="btn" onClick={handleExport} disabled={exporting}>
            <Download size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            {exporting ? 'Gerando...' : 'Exportar meus dados'}
          </button>
        </div>
      </div>

      {/* Apagar conta */}
      <div className="danger-zone">
        <span className="settings-section-title" style={{ color: 'var(--danger)' }}>
          <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
          Apagar conta
        </span>
        <p className="item-tag" style={{ margin: 0 }}>
          Isso apaga permanentemente sua conta e todos os seus dados (agenda, financeiro, estudos). Não tem como
          desfazer.
        </p>
        <div className="settings-row">
          <label>Senha atual</label>
          <input
            type="password"
            value={dangerPassword}
            onChange={(e) => setDangerPassword(e.target.value)}
          />
        </div>
        <div className="settings-row">
          <label>Digite EXCLUIR para confirmar</label>
          <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        </div>
        {dangerError && <span className="auth-error">{dangerError}</span>}
        <div className="settings-actions">
          <button className="btn btn-danger" onClick={handleDeleteAccount} disabled={deleting}>
            {deleting ? 'Apagando...' : 'Apagar conta permanentemente'}
          </button>
        </div>
      </div>
    </main>
  );
}
