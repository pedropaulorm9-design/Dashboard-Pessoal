import { useState } from 'react';
import { Calendar, Check, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

export default function Agenda() {
  const { user } = useAuth();
  const { items: tasks, loading, addItem, updateItem, removeItem } = useFirestoreCollection(
    user.uid,
    'tasks',
    'time'
  );

  const [newTask, setNewTask] = useState({ time: '', title: '', tag: '' });

  function handleAdd() {
    if (!newTask.title.trim()) return;
    addItem({
      time: newTask.time || '--:--',
      title: newTask.title.trim(),
      tag: newTask.tag.trim() || 'Geral',
      done: false,
    });
    setNewTask({ time: '', title: '', tag: '' });
  }

  const pending = tasks.filter((t) => !t.done).length;

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
        <div className="list">
          {loading && <div className="empty">Carregando...</div>}
          {!loading && tasks.length === 0 && (
            <div className="empty">Nenhum compromisso ainda. Adicione um abaixo.</div>
          )}
          {tasks.map((t) => (
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

      <p className="empty" style={{ marginTop: 14 }}>
        {pending} tarefa{pending !== 1 ? 's' : ''} pendente{pending !== 1 ? 's' : ''}
      </p>
    </main>
  );
}
