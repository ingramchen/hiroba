import {
  CrowdOrientedInputQuota,
  DEGRADE_SERVER_WAIT_SECONDS,
  DELETE_MEDIA_PER_WINDOW,
  DELETE_MEDIA_WINDOW_MS,
  LIMITS,
  SEND_RULE_SLACK_MS,
  SpeedInputQuota,
  WASH_GUARD_INTERVAL_MS,
  WashGuard,
  isMeteredSend,
  tierAllows,
  washGuardAllowance,
  type ChatterAuth,
  type ErrorCode,
  type InputQuota,
  type SendFrame,
} from '@hiroba/shared';

const MAX_TICKS_PER_SYNC = 1000;

interface MemberState {
  quota: InputQuota;
  startedAt: number;
  ticked: number;
  wash: WashGuard;
  lockUntil: number;
  deletes: number[];
}

export type SendVerdict = Extract<
  ErrorCode,
  'SEND_TOO_FAST' | 'INVALID_MESSAGE' | 'WASH_GUARD'
> | null;

function makeQuota(auth: ChatterAuth): InputQuota {
  return auth.kermaEnough
    ? new CrowdOrientedInputQuota(LIMITS.contentServer)
    : new SpeedInputQuota(DEGRADE_SERVER_WAIT_SECONDS);
}

export class SendPolicy {
  private readonly states = new Map<string, MemberState>();

  register(auth: ChatterAuth, crowd: number, now: number): void {
    const existing = this.states.get(auth.publicId);
    if (existing !== undefined) {
      existing.quota = makeQuota(auth);
      existing.startedAt = now;
      existing.ticked = 0;
      this.crowdFor(existing, crowd);
      return;
    }
    const state: MemberState = {
      quota: makeQuota(auth),
      startedAt: now,
      ticked: 0,
      wash: new WashGuard(
        washGuardAllowance(auth.anchorUsername.length > 0),
        now,
        WASH_GUARD_INTERVAL_MS - SEND_RULE_SLACK_MS,
      ),
      lockUntil: 0,
      deletes: [],
    };
    this.crowdFor(state, crowd);
    this.states.set(auth.publicId, state);
  }

  release(publicId: string, now: number): void {
    const state = this.states.get(publicId);
    if (state === undefined) {
      return;
    }
    if (state.lockUntil > now || state.wash.newestAccess + WASH_GUARD_INTERVAL_MS > now) {
      return;
    }
    this.states.delete(publicId);
  }

  crowdChanged(crowd: number, now: number): void {
    for (const state of this.states.values()) {
      this.sync(state, now);
      this.crowdFor(state, crowd);
    }
  }

  check(auth: ChatterAuth, frame: SendFrame, now: number): SendVerdict {
    const state = this.states.get(auth.publicId);
    if (state === undefined) {
      return 'SEND_TOO_FAST';
    }
    if (!tierAllows(frame.eventType, frame.content.length, auth.kermaEnough)) {
      return 'INVALID_MESSAGE';
    }
    if (!isMeteredSend(frame.eventType)) {
      state.deletes = state.deletes.filter((at) => at + DELETE_MEDIA_WINDOW_MS > now);
      return state.deletes.length >= DELETE_MEDIA_PER_WINDOW ? 'SEND_TOO_FAST' : null;
    }
    if (state.lockUntil > now) {
      return 'WASH_GUARD';
    }
    this.sync(state, now);
    return state.quota.isEnough(frame.content) ? null : 'SEND_TOO_FAST';
  }

  accept(auth: ChatterAuth, frame: SendFrame, now: number): boolean {
    const state = this.states.get(auth.publicId);
    if (state === undefined) {
      return false;
    }
    if (!isMeteredSend(frame.eventType)) {
      state.deletes.push(now);
      return false;
    }
    state.quota.consume(frame.content.length);
    if (state.quota instanceof SpeedInputQuota) {
      state.startedAt = now;
      state.ticked = 0;
    }
    if (state.wash.check(now)) {
      return false;
    }
    state.lockUntil = WashGuard.lockUntil(now);
    return true;
  }

  purge(present: ReadonlySet<string>): void {
    for (const publicId of this.states.keys()) {
      if (!present.has(publicId)) {
        this.states.delete(publicId);
      }
    }
  }

  private sync(state: MemberState, now: number): void {
    const due = Math.floor((now - state.startedAt + SEND_RULE_SLACK_MS) / 1000);
    let granted = 0;
    while (state.ticked < due && granted < MAX_TICKS_PER_SYNC) {
      state.quota.giveQuota();
      state.ticked += 1;
      granted += 1;
    }
    if (state.ticked < due) {
      state.ticked = due;
    }
  }

  private crowdFor(state: MemberState, crowd: number): void {
    if (state.quota instanceof CrowdOrientedInputQuota) {
      state.quota.onCrowdChange(crowd);
    }
  }
}
