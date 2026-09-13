export const TIME_ZONE_KEY = 'SCHEDULE_TIME_ZONE';
export const FALLBACK_TIME_ZONE = 'UTC';

export function timeZoneConfigured(env: Record<string, string | undefined>): boolean {
  const configured = env[TIME_ZONE_KEY];
  return configured !== undefined && configured.trim().length > 0;
}

export function readTimeZone(env: Record<string, string | undefined>): string {
  if (!timeZoneConfigured(env)) {
    return FALLBACK_TIME_ZONE;
  }
  const zone = (env[TIME_ZONE_KEY] as string).trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
  } catch {
    throw new Error(`${TIME_ZONE_KEY} is not a time zone: ${zone}`);
  }
  return zone;
}
