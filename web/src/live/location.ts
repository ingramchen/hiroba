export interface SquareLocation {
  host: string;
  hostHref: string;
  title: string;
}

export function squareLocation(
  topic: string,
  location: { hostname: string; origin: string },
): SquareLocation {
  return {
    host: location.hostname,
    hostHref: location.origin,
    title: `${topic} | ${location.hostname}`,
  };
}
