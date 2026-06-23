import { toKey } from '../utils/dateKey';

const WEEKS = 14;

function intensityLevel(minutes) {
  if (minutes <= 0) return 0;
  if (minutes < 20) return 1;
  if (minutes < 45) return 2;
  if (minutes < 90) return 3;
  return 4;
}

export default function StudyHeatmap({ days }) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (WEEKS * 7 - 1));
  start.setDate(start.getDate() - start.getDay()); // alinha no domingo

  const columns = Array.from({ length: WEEKS + 1 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = toKey(date);
      return { key, minutes: days[key] || 0, future: date > today };
    })
  );

  return (
    <div className="heatmap-scroll">
      <div className="heatmap-grid">
        {columns.map((col, i) => (
          <div className="heatmap-col" key={i}>
            {col.map((cell) => (
              <div
                key={cell.key}
                className={`heatmap-cell level-${cell.future ? 'future' : intensityLevel(cell.minutes)}`}
                title={`${cell.key} — ${cell.minutes} min`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap-legend">
        <span>menos</span>
        <span className="heatmap-cell level-0" />
        <span className="heatmap-cell level-1" />
        <span className="heatmap-cell level-2" />
        <span className="heatmap-cell level-3" />
        <span className="heatmap-cell level-4" />
        <span>mais</span>
      </div>
    </div>
  );
}
