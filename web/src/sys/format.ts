export function formatTime(ms: number): string {
  const at = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    String(at.getFullYear()) +
    '-' +
    pad(at.getMonth() + 1) +
    '-' +
    pad(at.getDate()) +
    ' ' +
    pad(at.getHours()) +
    ':' +
    pad(at.getMinutes()) +
    ':' +
    pad(at.getSeconds())
  );
}

export function formatDays(ms: number): string {
  const days = ms / (24 * 60 * 60 * 1000);
  return Number.isInteger(days) ? String(days) : days.toFixed(1);
}
