import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const FOCO_SECONDS = 25 * 60;
const PAUSA_SECONDS = 5 * 60;

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PomodoroTimer({ subjects, onSessionComplete }) {
  const [mode, setMode] = useState('foco');
  const [secondsLeft, setSecondsLeft] = useState(FOCO_SECONDS);
  const [running, setRunning] = useState(false);
  const [subjectId, setSubjectId] = useState('');

  const intervalRef = useRef(null);

  function handleCycleEnd() {
    clearInterval(intervalRef.current);
    setRunning(false);
    if (mode === 'foco') {
      const activeSubject = subjectId || subjects[0]?.id;
      if (activeSubject) onSessionComplete(activeSubject, 25);
      setMode('pausa');
      setSecondsLeft(PAUSA_SECONDS);
    } else {
      setMode('foco');
      setSecondsLeft(FOCO_SECONDS);
    }
  }

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          handleCycleEnd();
          return prev;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode]);

  function toggleRunning() {
    setRunning((prev) => !prev);
  }

  function reset() {
    setRunning(false);
    setMode('foco');
    setSecondsLeft(FOCO_SECONDS);
  }

  const total = mode === 'foco' ? FOCO_SECONDS : PAUSA_SECONDS;
  const pct = ((total - secondsLeft) / total) * 100;

  return (
    <div className="pomodoro">
      <div className="pomodoro-mode">{mode === 'foco' ? 'Foco' : 'Pausa'}</div>
      <div className="pomodoro-time">{formatTime(secondsLeft)}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>

      {subjects.length > 0 && (
        <select
          value={subjectId || subjects[0]?.id}
          onChange={(e) => setSubjectId(e.target.value)}
          disabled={running}
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}

      <div className="pomodoro-controls">
        <button className="add-btn" onClick={toggleRunning} aria-label={running ? 'Pausar' : 'Iniciar'}>
          {running ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className="icon-btn" onClick={reset} aria-label="Reiniciar">
          <RotateCcw size={15} />
        </button>
      </div>
    </div>
  );
}
