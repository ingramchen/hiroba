export function toggleBallotChoice(
  selected: readonly number[],
  index: number,
  checked: boolean,
  max: number,
): number[] {
  if (!checked) {
    return selected.filter((entry) => entry !== index);
  }
  if (selected.includes(index)) {
    return [...selected];
  }
  const next = [...selected, index];
  return next.length > max ? next.slice(next.length - max) : next;
}
