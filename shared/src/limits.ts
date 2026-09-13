export const LIMITS = {
  historyRing: 100,
  chatPaneRows: 500,
  contentClient: 500,
  contentServer: 505,
  nicknameServer: 20,
  replyPublicIdsClient: 3,
  replyPublicIdsServer: 5,
  homeListSize: 25,
  homeListMessages: 3,
  latestMinCrowd: 10,
  crowdBroadcastMaxDelayMs: 30_000,
  crowdBroadcastStepCrowd: 100,
  clientHeartbeatMs: 180_000,
  frameBytes: 8192,
} as const;

export function crowdBroadcastDelayMs(crowd: number): number {
  const steps = Math.floor(crowd / LIMITS.crowdBroadcastStepCrowd);
  return Math.min(LIMITS.crowdBroadcastMaxDelayMs, steps * 1000);
}
