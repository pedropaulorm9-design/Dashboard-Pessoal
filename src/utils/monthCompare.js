export function isInMonthOffset(dateStr, offset) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth();
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
