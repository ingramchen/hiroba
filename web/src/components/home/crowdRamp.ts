export const CROWD_RAMP_STEPS = 10;
export const CROWD_RAMP_INTERVAL_MS = 1000 / CROWD_RAMP_STEPS;

export function crowdRamp(from: number, to: number): number[] {
  const increment = Math.trunc((to - from) / CROWD_RAMP_STEPS);
  if (Math.abs(increment) < 1) {
    return [to];
  }
  const values: number[] = [];
  let current = from;
  for (let step = 1; step < CROWD_RAMP_STEPS; step += 1) {
    current += increment;
    values.push(current);
  }
  values.push(to);
  return values;
}
