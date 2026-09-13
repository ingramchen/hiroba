import {
  LIMITS,
  PROTOCOL_VERSION,
  type ClientEventType,
  type MessageEventPayload,
  type ServerFrame,
} from '@hiroba/shared';

export const CONNECT_RETRY_TICK_MS = 300;
export const MAX_CONNECT_RETRY = 70;
export const CONNECT_DETECT_MS = CONNECT_RETRY_TICK_MS * MAX_CONNECT_RETRY;
export const DETECT_TICK_MS = 1000;
export const DETECT_FAIL_LIMIT = 7;

export interface SquareSocketHandlers {
  onFrame: (frame: ServerFrame) => void;
  onOpenFailed: () => void;
}

export class ConnectionWatch {
  private timer: ReturnType<typeof setInterval> | null = null;
  private failCount = 0;

  constructor(
    private readonly isActive: () => boolean,
    private readonly onLost: () => void,
  ) {}

  start(): void {
    this.stop();
    this.failCount = 0;
    this.timer = setInterval(() => {
      if (this.failCount > DETECT_FAIL_LIMIT) {
        this.stop();
        this.onLost();
        return;
      }
      this.failCount = this.isActive() ? 0 : this.failCount + 1;
    }, DETECT_TICK_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export function squareSocketUrl(topic: string, location: Location = window.location): string {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${location.host}/ws/${encodeURIComponent(topic)}`;
}

export class SquareSocket {
  private socket: WebSocket | null = null;
  private heartbeat: number | null = null;
  private opened = false;

  constructor(private readonly handlers: SquareSocketHandlers) {}

  get active(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  open(topic: string, token: string, nickname: string): void {
    this.close();
    const socket = new WebSocket(squareSocketUrl(topic));
    this.socket = socket;
    this.opened = false;
    socket.addEventListener('open', () => {
      this.opened = true;
      socket.send(JSON.stringify({ t: 'sub', v: PROTOCOL_VERSION, token, nickname }));
      this.heartbeat = window.setInterval(() => {
        this.send({ t: 'ping' });
      }, LIMITS.clientHeartbeatMs);
    });
    socket.addEventListener('message', (message: MessageEvent<string>) => {
      let frame: ServerFrame;
      try {
        frame = JSON.parse(message.data) as ServerFrame;
      } catch {
        return;
      }
      this.handlers.onFrame(frame);
    });
    socket.addEventListener('error', () => {
      if (!this.opened) {
        this.handlers.onOpenFailed();
      }
    });
    socket.addEventListener('close', () => {
      this.stopHeartbeat();
      if (this.socket === socket) {
        this.socket = null;
      }
    });
  }

  send(frame: Record<string, unknown>): boolean {
    const socket = this.socket;
    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify(frame));
    return true;
  }

  sendMessage(input: {
    eventType: ClientEventType;
    senderPublicId: string;
    senderNickName: string;
    anchorUsername: string;
    content: string;
    payload?: MessageEventPayload;
  }): boolean {
    return this.send({ t: 'send', ...input });
  }

  sendNickname(nickname: string): boolean {
    return this.send({ t: 'nickname', nickname });
  }

  close(): void {
    this.stopHeartbeat();
    const socket = this.socket;
    this.socket = null;
    if (socket !== null) {
      socket.close();
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeat !== null) {
      window.clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }
}

export interface PageLifecycleHandlers {
  onHide: () => void;
  onRestore: () => void;
}

export class PageLifecycle {
  private readonly onPageHide = (): void => {
    this.handlers.onHide();
  };

  private readonly onFreeze = (): void => {
    this.handlers.onHide();
  };

  private readonly onPageShow = (event: Event): void => {
    if ((event as PageTransitionEvent).persisted) {
      this.handlers.onRestore();
    }
  };

  private readonly onResume = (): void => {
    this.handlers.onRestore();
  };

  constructor(
    private readonly handlers: PageLifecycleHandlers,
    private readonly target: EventTarget = window,
    private readonly document: EventTarget = window.document,
  ) {}

  start(): void {
    this.target.addEventListener('pagehide', this.onPageHide);
    this.target.addEventListener('pageshow', this.onPageShow);
    this.document.addEventListener('freeze', this.onFreeze);
    this.document.addEventListener('resume', this.onResume);
  }

  stop(): void {
    this.target.removeEventListener('pagehide', this.onPageHide);
    this.target.removeEventListener('pageshow', this.onPageShow);
    this.document.removeEventListener('freeze', this.onFreeze);
    this.document.removeEventListener('resume', this.onResume);
  }
}
