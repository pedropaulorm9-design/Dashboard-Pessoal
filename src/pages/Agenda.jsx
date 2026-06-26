import { useEffect, useRef, useState } from 'react';
import { Calendar, Check, Plus, Trash2, Search, Repeat, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import MonthCalendar from '../components/MonthCalendar';
import WeekCalendar from '../components/WeekCalendar';
import { toKey } from '../utils/dateKey';
import {
  taskOccursOn,
  isTaskDoneOn,
  weekdayName,
  WEEKDAY_LONG,
  recurrenceLabel,
  nextOccurrences,
} from '../utils/recurrence';
import { tagColor, isImportantTag } from '../utils/tagColor';
import {
  toOneSignalSendAfter,
  requestNotificationPermissionSafe,
  getNotificationPermission,
  scheduleTaskNotification,
  cancelTaskNotification,
} from '../utils/notifications';

function formatSelected(dateKey) {
  const today = toKey(new Date());
  const date = new Date(dateKey + 'T00:00:00');
  const label = `${WEEKDAY_LONG[date.getDay()]}, ${date.getDate()} de ${date.toLocaleDateString('pt-BR', { month: 'long' })}`;
  return dateKey === today ? `Hoje — ${label}` : label;
}

function TagChip({ tag }) {
  const color = tagColor(tag);
  return (
    <span className="tag-chip" style={{ color, backgroundColor: `${color}26` }}>
      {tag}
    </span>
  );
}

export default function Agenda() {
  const { user } = useAuth();
  const { items: tasks, loading, addItem, updateItem, removeItem } = useFirestoreCollection(
    user.uid,
    'tasks'
  );

  const [selectedDate, setSelectedDate] = useState(() => toKey(new Date()));
  const [viewMode, setViewMode] = useState('mes');
  const [searchQuery, setSearchQuery] = useState('');
  const [newTask, setNewTask] = useState({ time: '', title: '', tag: '', repeatMode: 'none', intervalDays: '' });
  const [notifPermission, setNotifPermission] = useState(null);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const toppedUpRef = useRef(new Set());
  const bannerTimerRef = useRef(null);

  useEffect(() => {
    getNotificationPermission().then((perm) => {
      setNotifPermission(perm);
      // Só sugere uma vez por dispositivo. Depois disso, só dá pra
      // ativar pela tela de Configurações.
      if (!perm && !localStorage.getItem('agenda-notif-banner-seen')) {
        localStorage.setItem('agenda-notif-banner-seen', '1');
        setShowNotifBanner(true);
        bannerTimerRef.current = setTimeout(() => setShowNotifBanner(false), 6000);
      }
    });

    // Revalida sempre que a aba volta a ficar visível — assim, se a
    // permissão mudou por fora do nosso botão (ex: um prompt automático
    // do próprio OneSignal, ou o usuário mudando nas configurações do
    // navegador), o app não fica com um estado desatualizado.
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        getNotificationPermission().then(setNotifPermission);
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(bannerTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  async function handleEnableNotifications() {
    clearTimeout(bannerTimerRef.current);
    setShowNotifBanner(true);
    setNotifError('');
    setNotifBusy(true);
    const result = await requestNotificationPermissionSafe();
    setNotifBusy(false);

    if (result === 'timeout') {
      setNotifError('Não conseguimos falar com o serviço de notificações agora. Verifique sua internet (ou se algum bloqueador de anúncio está travando o site) e tente de novo.');
      return;
    }
    setNotifPermission(result);
    if (!result) {
      setNotifError('Seu navegador não liberou a notificação. Se você já negou antes, precisa permitir manualmente nas configurações de notificação do navegador/celular para este site.');
    }
  }

  const tasksForDay = tasks
    .filter((t) => taskOccursOn(t, selectedDate))
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const legacyTasks = tasks.filter((t) => !t.date);

  const query = searchQuery.trim().toLowerCase();
  const searchResults = query
    ? tasks
        .filter((t) => t.date && (t.title.toLowerCase().includes(query) || (t.tag || '').toLowerCase().includes(query)))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    : [];

  // Mantém umas 8 ocorrências futuras agendadas pra cada tarefa recorrente
  // com horário definido. Roda uma vez por tarefa por sessão (a lista de
  // tarefas muda toda hora por causa do tempo real, então sem essa guarda
  // isso rodaria em loop).
  async function topUpRecurringNotifications(task) {
    if (!/^\d{1,2}:\d{2}$/.test(task.time)) return;
    const livePermission = await getNotificationPermission();
    if (!livePermission) return;

    const todayKey = toKey(new Date());
    const existing = task.notificationIds || {};
    const futureCount = Object.keys(existing).filter((d) => d >= todayKey).length;
    if (futureCount >= 4) return;

    const upcoming = nextOccurrences(task, 8, todayKey);
    const newEntries = {};
    for (const dateKey of upcoming) {
      if (existing[dateKey]) continue;
      const [h, m] = task.time.split(':').map(Number);
      const target = new Date(dateKey + 'T00:00:00');
      target.setHours(h, m, 0, 0);
      if (target <= new Date()) continue;

      const id = await scheduleTaskNotification({
        title: isImportantTag(task.tag) ? `🔴 IMPORTANTE: ${task.title}` : task.title,
        message: `${task.time} · ${task.tag}`,
        sendAfter: toOneSignalSendAfter(dateKey, task.time),
      });
      if (id) newEntries[dateKey] = id;
    }
    if (Object.keys(newEntries).length > 0) {
      updateItem(task.id, { notificationIds: { ...existing, ...newEntries } });
    }
  }

  useEffect(() => {
    tasks.forEach((t) => {
      if (t.recurrence && !toppedUpRef.current.has(t.id)) {
        toppedUpRef.current.add(t.id);
        topUpRecurringNotifications(t);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  async function handleAdd() {
    if (!newTask.title.trim()) return;
    const base = {
      date: selectedDate,
      time: newTask.time || '--:--',
      title: newTask.title.trim(),
      tag: newTask.tag.trim() || 'Geral',
    };

    if (newTask.repeatMode !== 'none') {
      let recurrence = null;
      if (newTask.repeatMode === 'weekly') {
        recurrence = { type: 'weekly', weekday: new Date(selectedDate + 'T00:00:00').getDay() };
      } else if (newTask.repeatMode === 'interval') {
        const days = parseInt(newTask.intervalDays, 10);
        if (!isNaN(days) && days >= 1) recurrence = { type: 'interval', days };
      }
      if (recurrence) {
        addItem({ ...base, recurrence, completedDates: [], notificationIds: {} });
      }
      setNewTask({ time: '', title: '', tag: '', repeatMode: 'none', intervalDays: '' });
      return;
    }

    let notificationId = null;
    const hasRealTime = /^\d{1,2}:\d{2}$/.test(base.time);
    if (hasRealTime) {
      const livePermission = await getNotificationPermission();
      if (livePermission !== notifPermission) setNotifPermission(livePermission);

      if (livePermission) {
        const [h, m] = base.time.split(':').map(Number);
        const target = new Date(selectedDate + 'T00:00:00');
        target.setHours(h, m, 0, 0);
        if (target > new Date()) {
          notificationId = await scheduleTaskNotification({
            title: isImportantTag(base.tag) ? `🔴 IMPORTANTE: ${base.title}` : base.title,
            message: `${base.time} · ${base.tag}`,
            sendAfter: toOneSignalSendAfter(selectedDate, base.time),
          });
        }
      }
    }

    addItem({ ...base, done: false, notificationId });
    setNewTask({ time: '', title: '', tag: '', repeatMode: 'none', intervalDays: '' });
  }

  async function toggleDone(task) {
    if (task.recurrence) {
      const current = task.completedDates || [];
      const willBeDone = !current.includes(selectedDate);
      const next = willBeDone
        ? [...current, selectedDate]
        : current.filter((d) => d !== selectedDate);

      const notifIds = { ...(task.notificationIds || {}) };
      if (willBeDone && notifIds[selectedDate]) {
        await cancelTaskNotification(notifIds[selectedDate]);
        delete notifIds[selectedDate];
      }
      updateItem(task.id, { completedDates: next, notificationIds: notifIds });
    } else {
      const nowDone = !task.done;
      if (nowDone && task.notificationId) {
        await cancelTaskNotification(task.notificationId);
      }
      updateItem(task.id, { done: nowDone });
    }
  }

  async function handleRemove(task) {
    if (task.notificationId) {
      await cancelTaskNotification(task.notificationId);
    }
    if (task.notificationIds) {
      await Promise.all(Object.values(task.notificationIds).map(cancelTaskNotification));
    }
    removeItem(task.id);
  }

  const pending = tasksForDay.filter((t) => !isTaskDoneOn(t, selectedDate)).length;

  return (
    <main className="page">
      <div className="page-header">
        <div className="page-icon-badge agenda">
          <Calendar size={18} />
        </div>
        <div>
          <span className="page-comment">// agenda</span>
          <h2 className="page-title">Compromissos</h2>
        </div>
      </div>

      {showNotifBanner && notifPermission === false && (
        <div className="card accent-agenda" style={{ marginBottom: 16 }}>
          <div className="settings-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
            <span className="item-tag" style={{ margin: 0 }}>
              Ative as notificações pra receber lembrete dos seus compromissos, mesmo com o app fechado.
            </span>
            <button className="btn btn-primary" onClick={handleEnableNotifications} disabled={notifBusy}>
              {notifBusy ? 'Ativando...' : 'Ativar notificações'}
            </button>
          </div>
          {notifError && <span className="auth-error">{notifError}</span>}
          <span className="item-tag" style={{ margin: 0 }}>
            Esse aviso só aparece uma vez neste dispositivo — depois, ative em Configurações.
          </span>
        </div>
      )}

      <div className="search-row" style={{ marginBottom: 16 }}>
        <Search size={15} />
        <input
          type="text"
          placeholder="Buscar tarefas por nome ou categoria..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {query ? (
        <div className="card accent-agenda">
          <div className="page-header" style={{ marginBottom: 0 }}>
            <span className="page-comment">// resultados da busca</span>
          </div>
          <div className="list">
            {searchResults.length === 0 && <div className="empty">Nada encontrado.</div>}
            {searchResults.map((t) => (
              <div className="item" key={t.id}>
                {!t.recurrence && (
                  <button
                    className={`check-btn ${t.done ? 'done' : ''}`}
                    onClick={() => toggleDone(t)}
                    aria-label="Marcar como concluída"
                  >
                    {t.done && <Check size={12} />}
                  </button>
                )}
                <div className="item-body">
                  <div className="item-title">
                    {t.recurrence ? (
                      <span className="search-result-date">{recurrenceLabel(t)}</span>
                    ) : (
                      <span className="search-result-date">{t.date}</span>
                    )}
                    {t.time !== '--:--' && t.time} {t.title}
                    {t.recurrence && <Repeat size={11} className="recurrence-icon" />}
                    {(t.notificationId || (t.notificationIds && Object.keys(t.notificationIds).length > 0)) && (
                      <Bell size={11} className="recurrence-icon" />
                    )}
                  </div>
                  <TagChip tag={t.tag} />
                </div>
                <button className="del-btn" onClick={() => handleRemove(t)} aria-label="Remover">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="view-toggle" style={{ marginBottom: 16 }}>
            <button className={viewMode === 'mes' ? 'active' : ''} onClick={() => setViewMode('mes')}>
              Mês
            </button>
            <button className={viewMode === 'semana' ? 'active' : ''} onClick={() => setViewMode('semana')}>
              Semana
            </button>
          </div>

          <div className="card accent-agenda">
            {viewMode === 'mes' ? (
              <MonthCalendar tasks={tasks} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            ) : (
              <WeekCalendar tasks={tasks} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            )}
          </div>

          <div className="card accent-agenda" style={{ marginTop: 16 }}>
            <span className="page-comment" style={{ textTransform: 'capitalize' }}>
              {formatSelected(selectedDate)}
            </span>

            <div className="list">
              {loading && <div className="empty">Carregando...</div>}
              {!loading && tasksForDay.length === 0 && (
                <div className="empty">Nada marcado para este dia. Adicione algo abaixo.</div>
              )}
              {tasksForDay.map((t) => {
                const done = isTaskDoneOn(t, selectedDate);
                return (
                  <div className="item" key={t.id}>
                    <button
                      className={`check-btn ${done ? 'done' : ''}`}
                      onClick={() => toggleDone(t)}
                      aria-label={done ? 'Marcar como pendente' : 'Marcar como concluída'}
                    >
                      {done && <Check size={12} />}
                    </button>
                    <span className="item-time">{t.time}</span>
                    <div className="item-body">
                      <div className={`item-title ${done ? 'done' : ''}`}>
                        {t.title}
                        {t.recurrence && <Repeat size={11} className="recurrence-icon" />}
                        {(t.notificationId || (t.notificationIds && Object.keys(t.notificationIds).length > 0)) && (
                          <Bell size={11} className="recurrence-icon" />
                        )}
                      </div>
                      <TagChip tag={t.tag} />
                    </div>
                    <button className="del-btn" onClick={() => handleRemove(t)} aria-label="Remover">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="add-row">
              <input
                className="w-time"
                type="text"
                placeholder="08:00"
                value={newTask.time}
                onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
              />
              <input
                className="flex-1"
                type="text"
                placeholder="O que precisa fazer?"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <input
                className="w-tag"
                type="text"
                placeholder="categoria"
                value={newTask.tag}
                onChange={(e) => setNewTask({ ...newTask, tag: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <button className="add-btn" onClick={handleAdd} aria-label="Adicionar compromisso">
                <Plus size={15} />
              </button>
            </div>

            <div className="repeat-toggle">
              <Repeat size={13} />
              <select
                value={newTask.repeatMode}
                onChange={(e) => setNewTask({ ...newTask, repeatMode: e.target.value })}
              >
                <option value="none">Não repetir</option>
                <option value="weekly">Toda {weekdayName(selectedDate)}</option>
                <option value="interval">A cada X dias</option>
              </select>
              {newTask.repeatMode === 'interval' && (
                <span className="repeat-toggle-days">
                  a cada
                  <input
                    type="number"
                    min="1"
                    placeholder="3"
                    value={newTask.intervalDays}
                    onChange={(e) => setNewTask({ ...newTask, intervalDays: e.target.value })}
                  />
                  dias
                </span>
              )}
            </div>
            {newTask.repeatMode !== 'none' && (
              <span className="item-tag" style={{ margin: 0 }}>
                {notifPermission
                  ? 'As próximas ocorrências também recebem lembrete, se tiverem horário definido.'
                  : 'Ative as notificações acima pra também receber lembrete das ocorrências futuras.'}
              </span>
            )}
          </div>

          {legacyTasks.length > 0 && (
            <div className="card accent-agenda" style={{ marginTop: 16 }}>
              <span className="page-comment">// criadas antes do calendário — sem data definida</span>
              <div className="list">
                {legacyTasks.map((t) => (
                  <div className="item" key={t.id}>
                    <div className="item-body">
                      <div className="item-title">{t.title}</div>
                      <TagChip tag={t.tag} />
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => updateItem(t.id, { date: toKey(new Date()) })}
                    >
                      Mover p/ hoje
                    </button>
                    <button className="del-btn" onClick={() => handleRemove(t)} aria-label="Remover">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="empty" style={{ marginTop: 14 }}>
            {pending} tarefa{pending !== 1 ? 's' : ''} pendente{pending !== 1 ? 's' : ''} neste dia
          </p>
        </>
      )}
    </main>
  );
}
