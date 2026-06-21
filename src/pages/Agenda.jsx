import { useState } from 'react';
import { Calendar, Check, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import MonthCalendar from '../components/MonthCalendar';
import { toKey } from '../utils/dateKey';

const WEEKDAY_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function formatSelected(dateKey) {
  const today = toKey(new Date());
  const date = new Date(dateKey + 'T00:00:00');
  const label = `${WEEKDAY_LONG[date.getDay()]}, ${date.getDate()} de ${date.toLocaleDateString('pt-BR', { month: 'long' })}`;
  return dateKey === today ? `Hoje — ${label}` : label;
}

export default function Agenda() {
  const { user } = useAuth();
  const { items: tasks, loading, addItem, updateItem, removeItem } = useFirestoreCollection(
    user.uid,
    'tasks'
  );

  const [selectedDate, setSelectedDate] = useState(() => toKey(new Date()));
  const [newTask, setNewTask] = useState({ time: '', title: '', tag: '' });

  const tasksForDay = tasks
    .filter((t) => t.date === selectedDate)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const legacyTasks = tasks.filter((t) => !t.date);

  function handleAdd() {
    if (!newTask.title.trim()) return;
    addItem({
      date: selectedDate,
      time: newTask.time || '--:--',
      title: newTask.title.trim(),
      tag: newTask.tag.trim() || 'Geral',
      done: false,
    });
    setNewTask({ time: '', title: '', tag: '' });
  }

  const pending = tasksForDay.filter((t) => !t.done).length;

  return (
    <main className="page">
      <div className="page-header">
        <Calendar size={18} />
        <div>
          <span className="page-comment">// agenda</span>
          <h2 className="page-title">Compromissos</h2>
        </div>
      </div>

      <div className="card accent-agenda">
        <MonthCalendar tasks={tasks} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
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
          {tasksForDay.map((t) => (
            <div className="item" key={t.id}>
              <button
                className={`check-btn ${t.done ? 'done' : ''}`}
                onClick={() => updateItem(t.id, { done: !t.done })}
                aria-label={t.done ? 'Marcar como pendente' : 'Marcar como concluída'}
              >
                {t.done && <Check size={12} />}
              </button>
              <span className="item-time">{t.time}</span>
              <div className="item-body">
                <div className={`item-title ${t.done ? 'done' : ''}`}>{t.title}</div>
                <div className="item-tag">{t.tag}</div>
              </div>
              <button className="del-btn" onClick={() => removeItem(t.id)} aria-label="Remover">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
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
      </div>

      {legacyTasks.length > 0 && (
        <div className="card accent-agenda" style={{ marginTop: 16 }}>
          <span className="page-comment">// criadas antes do calendário — sem data definida</span>
          <div className="list">
            {legacyTasks.map((t) => (
              <div className="item" key={t.id}>
                <div className="item-body">
                  <div className="item-title">{t.title}</div>
                  <div className="item-tag">{t.tag}</div>
                </div>
                <button
                  className="text-btn"
                  onClick={() => updateItem(t.id, { date: toKey(new Date()) })}
                >
                  Mover p/ hoje
                </button>
                <button className="del-btn" onClick={() => removeItem(t.id)} aria-label="Remover">
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
    </main>
  );
}
