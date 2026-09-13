export function chunk<T>(entries: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  if (size <= 0) {
    return rows;
  }
  for (let i = 0; i < entries.length; i += size) {
    rows.push(entries.slice(i, i + size));
  }
  return rows;
}
