import { useEffect, useRef, useState } from 'react';
import { Settings, Download, AlertTriangle, Camera, Bell } from 'lucide-react';
import { collection, deleteDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { db } from '../firebase';
import { resizeImageToBase64 } from '../utils/resizeImage';
import {
  getNotificationPermission,
  requestNotificationPermissionSafe,
  getOptedIn,
  setOptedIn,
} from '../utils/notifications';
import Avatar from '../components/Avatar';

const COLLECTIONS = ['tasks', 'transactions', 'subjects', 'recurringTransactions', 'studyDays'];

export default function Configuracoes() {
  const { user, updateDisplayName, changePassword, reauthenticate, deleteAccountWithPassword } = useAuth();
  const { preferences, updatePreferences } = useUserPreferences(user.uid);
  const fallbackText = (user.displayName || user.email || '?').slice(0, 1).toUpperCase();

  const [name, setName] = useState(user.displayName || '');
  const [nameMsg, setNameMsg] = useState('');

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef(null);

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  const [exporting, setExporting] = useState(false);

  const [dangerPassword, setDangerPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [dangerError, setDangerError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [notifPermission, setNotifPermission] = useState(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifError, setNotifError] = useState('');

  useEffect(() => {
    getNotificationPermission().then(setNotifPermission);
    getOptedIn().then(setNotifEnabled);
  }, []);

  async function handleToggleNotifications() {
    setNotifError('');
    setNotifBusy(true);
    try {
      if (!notifPermission) {
        const result = await requestNotificationPermissionSafe();
        if (result === 'timeout') {
          setNotifError('Não conseguimos falar com o serviço de notificações agora. Tente de novo em alguns segundos.');
          return;
        }
        setNotifPermission(result);
        if (!result) {
          setNotifError('Seu navegador não liberou a notificação. Se já negou antes, permita manualmente nas configurações do navegador/celular para este site.');
          return;
        }
        setNotifEnabled(await getOptedIn());
      } else {
        const next = await setOptedIn(!notifEnabled);
        setNotifEnabled(next);
      }
    } finally {
      setNotifBusy(false);
    }
  }

  async function handleSaveName() {
    setNameMsg('');
    await updateDisplayName(name.trim());
    setNameMsg('Nome atualizado.');
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');

    if (!file.type.startsWith('image/')) {
      setPhotoError('Selecione um arquivo de imagem.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setPhotoError('Imagem muito grande (máximo 15MB).');
      return;
    }

    setPhotoUploading(true);
    try {
      const dataUrl = await resizeImageToBase64(file);
      await updatePreferences({ photoData: dataUrl });
    } catch {
      setPhotoError('Não foi possível processar essa imagem. Tente outra foto.');
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
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
        <div className="page-icon-badge config">
          <Settings size={18} />
        </div>
        <div>
          <span className="page-comment">// configurações</span>
          <h2 className="page-title">Configurações</h2>
        </div>
      </div>

      {/* Perfil */}
      <div className="card" style={{ marginBottom: 16 }}>
        <span className="settings-section-title">Perfil</span>

        <div className="settings-actions" style={{ alignItems: 'center' }}>
          <Avatar src={preferences.photoData} fallbackText={fallbackText} size={64} />
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
            <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={photoUploading}>
              <Camera size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              {photoUploading ? 'Processando...' : 'Escolher da galeria'}
            </button>
          </div>
        </div>
        {photoError && <span className="auth-error">{photoError}</span>}

        <hr className="settings-divider" />

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

      {/* Notificações */}
      <div className="card" style={{ marginBottom: 16 }}>
        <span className="settings-section-title">Notificações</span>
        <div className="settings-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
          <span className="item-tag" style={{ margin: 0 }}>
            {!notifPermission
              ? 'Desativadas — ative pra receber lembrete dos seus compromissos.'
              : notifEnabled
              ? 'Ativadas — você recebe lembrete dos seus compromissos.'
              : 'Pausadas — você não vai receber lembretes até reativar.'}
          </span>
          <button className="btn btn-primary" onClick={handleToggleNotifications} disabled={notifBusy}>
            <Bell size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            {notifBusy ? 'Ativando...' : !notifPermission ? 'Ativar' : notifEnabled ? 'Desativar' : 'Reativar'}
          </button>
        </div>
        {notifError && <span className="auth-error">{notifError}</span>}
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
