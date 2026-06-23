import { useMemo, useState } from 'react';
import { BookOpen, Plus, Trash2, Clock, Flame } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useStudyStreak } from '../hooks/useStudyStreak';
import { useStudyDays } from '../hooks/useStudyDays';
import { toKey } from '../utils/dateKey';
import PomodoroTimer from '../components/PomodoroTimer';
import StudyHeatmap from '../components/StudyHeatmap';

const SUBJECT_COLORS = ['#7aa2d4', '#7fb88a', '#d4a95e', '#b98fd4', '#d4707a', '#6fc2c9', '#c9c46f'];

function formatMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export default function Estudos() {
  const { user } = useAuth();
  const { items: subjects, loading, addItem, updateItem, removeItem } = useFirestoreCollection(
    user.uid,
    'subjects'
  );
  const { streak, registerStudyToday } = useStudyStreak(user.uid);
  const { days, addMinutes } = useStudyDays(user.uid);

  const [newSubject, setNewSubject] = useState({ name: '', goalHours: '' });
  const [studyLog, setStudyLog] = useState({ subjectId: '', minutes: '' });
  const [goalDrafts, setGoalDrafts] = useState({});

  function handleAddSubject() {
    const goalHours = parseFloat(newSubject.goalHours);
    if (!newSubject.name.trim()) return;
    addItem({
      name: newSubject.name.trim(),
      goalMinutes: isNaN(goalHours) ? 0 : Math.round(goalHours * 60),
      loggedMinutes: 0,
    });
    setNewSubject({ name: '', goalHours: '' });
  }

  function commitGoal(subject) {
    const draft = goalDrafts[subject.id];
    if (draft === undefined) return;
    const hours = parseFloat(draft);
    const goalMinutes = isNaN(hours) ? subject.goalMinutes : Math.round(hours * 60);
    updateItem(subject.id, { goalMinutes });
    setGoalDrafts((prev) => {
      const next = { ...prev };
      delete next[subject.id];
      return next;
    });
  }

  // usada tanto pelo registro manual quanto pelo Pomodoro
  function logStudySession(subjectId, minutes) {
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) return;
    updateItem(subject.id, { loggedMinutes: (subject.loggedMinutes || 0) + minutes });
    registerStudyToday();
    addMinutes(toKey(new Date()), minutes);
  }

  function handleLogStudy() {
    const mins = parseInt(studyLog.minutes, 10);
    const subjectId = studyLog.subjectId || subjects[0]?.id;
    if (!subjectId || isNaN(mins) || mins <= 0) return;
    logStudySession(subjectId, mins);
    setStudyLog({ ...studyLog, minutes: '' });
  }

  const totalLogged = subjects.reduce((acc, s) => acc + (s.loggedMinutes || 0), 0);

  const pieData = useMemo(
    () => subjects.filter((s) => (s.loggedMinutes || 0) > 0).map((s) => ({ name: s.name, value: s.loggedMinutes })),
    [subjects]
  );

  return (
    <main className="page">
      <div className="page-header">
        <div className="page-icon-badge estudos">
          <BookOpen size={18} />
        </div>
        <div>
          <span className="page-comment">// estudos</span>
          <h2 className="page-title">Matérias</h2>
        </div>
      </div>

      {streak > 0 && (
        <div className="streak-badge" style={{ marginBottom: 14 }}>
          <Flame size={14} color="var(--accent-estudos)" />
          {streak} dia{streak !== 1 ? 's' : ''} seguido{streak !== 1 ? 's' : ''} estudando
        </div>
      )}

      {subjects.length > 0 && (
        <div className="card accent-estudos" style={{ marginBottom: 16 }}>
          <span className="page-comment">// pomodoro</span>
          <PomodoroTimer subjects={subjects} onSessionComplete={logStudySession} />
        </div>
      )}

      <div className="card accent-estudos">
        <div className="list">
          {loading && <div className="empty">Carregando...</div>}
          {!loading && subjects.length === 0 && (
            <div className="empty">Nenhuma matéria cadastrada. Adicione uma abaixo.</div>
          )}
          {subjects.map((s) => {
            const goal = s.goalMinutes || 0;
            const logged = s.loggedMinutes || 0;
            const pct = goal > 0 ? Math.min(100, (logged / goal) * 100) : 0;
            const goalValue = goalDrafts[s.id] ?? (goal / 60).toString();
            return (
              <div className="subject-card" key={s.id}>
                <div className="subject-top">
                  <span className="subject-name">{s.name}</span>
                  <button className="del-btn" onClick={() => removeItem(s.id)} aria-label="Excluir matéria">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${pct}%` }} />
                </div>

                <div className="subject-top">
                  <span className="subject-time">
                    {formatMinutes(logged)} estudados {goal > 0 ? `de ${formatMinutes(goal)}` : ''}
                  </span>
                  <span className="goal-row">
                    meta:
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={goalValue}
                      onChange={(e) =>
                        setGoalDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                      }
                      onBlur={() => commitGoal(s)}
                      onKeyDown={(e) => e.key === 'Enter' && commitGoal(s)}
                    />
                    h/semana
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="add-row">
          <input
            className="flex-1"
            type="text"
            placeholder="Nova matéria"
            value={newSubject.name}
            onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
          />
          <input
            className="w-minutes"
            type="number"
            min="0"
            step="0.5"
            placeholder="meta (h)"
            value={newSubject.goalHours}
            onChange={(e) => setNewSubject({ ...newSubject, goalHours: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
          />
          <button className="add-btn" onClick={handleAddSubject} aria-label="Adicionar matéria">
            <Plus size={15} />
          </button>
        </div>
      </div>

      {subjects.length > 0 && (
        <div className="card accent-estudos" style={{ marginTop: 16 }}>
          <span className="page-comment">// registrar sessão manual</span>
          <div className="add-row">
            <select
              className="flex-1"
              value={studyLog.subjectId || subjects[0]?.id}
              onChange={(e) => setStudyLog({ ...studyLog, subjectId: e.target.value })}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              className="w-minutes"
              type="number"
              placeholder="minutos"
              value={studyLog.minutes}
              onChange={(e) => setStudyLog({ ...studyLog, minutes: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleLogStudy()}
            />
            <button className="add-btn" onClick={handleLogStudy} aria-label="Registrar sessão de estudo">
              <Clock size={15} />
            </button>
          </div>
        </div>
      )}

      <div className="card accent-estudos" style={{ marginTop: 16 }}>
        <span className="page-comment">// constância nos últimos meses</span>
        <StudyHeatmap days={days} />
      </div>

      {pieData.length > 0 && (
        <div className="card accent-estudos" style={{ marginTop: 16 }}>
          <span className="page-comment">// o que você mais estuda</span>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={SUBJECT_COLORS[i % SUBJECT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatMinutes(value)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <p className="empty" style={{ marginTop: 14 }}>
        Total estudado: {formatMinutes(totalLogged)}
      </p>
    </main>
  );
}
