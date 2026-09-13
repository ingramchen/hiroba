import type { ModerationConfig, RemoteClassifier } from '../config.js';

export const CLASSIFY_TIMEOUT_MS = 30_000;

export const CLASSIFIER_VERDICTS = ['pass', 'flag', 'block'] as const;

export type ClassifierVerdict = (typeof CLASSIFIER_VERDICTS)[number];

export interface ClassifierAnswer {
  verdict: ClassifierVerdict;
  rule: string;
  thresholdsVersion: string;
}

export type ClassifyFailureKind = 'service' | 'image';

export type ClassifyOutcome =
  | { ok: true; answer: ClassifierAnswer }
  | { ok: false; kind: ClassifyFailureKind; status: number | null; reason: string };

const VERDICT_SET: ReadonlySet<string> = new Set(CLASSIFIER_VERDICTS);

export function classifierEndpoint(config: RemoteClassifier): string {
  return `${config.url}/classify`;
}

export function failureKindFor(status: number): ClassifyFailureKind {
  if (status >= 500 || status === 401 || status === 403 || status === 404) {
    return 'service';
  }
  return 'image';
}

function readAnswer(body: unknown): ClassifierAnswer | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;
  const verdict = record['verdict'];
  if (typeof verdict !== 'string' || !VERDICT_SET.has(verdict)) {
    return null;
  }
  return {
    verdict: verdict as ClassifierVerdict,
    rule: typeof record['rule'] === 'string' ? record['rule'] : '',
    thresholdsVersion:
      typeof record['thresholds_version'] === 'string' ? record['thresholds_version'] : '',
  };
}

export async function classify(
  config: ModerationConfig,
  endpoint: string,
  imageUrl: string,
  fetcher: typeof fetch,
): Promise<ClassifyOutcome> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (config.token !== null) {
    headers['authorization'] = `Bearer ${config.token}`;
  }
  let answer: Response;
  const startedAt = Date.now();
  try {
    answer = await fetcher(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: imageUrl }),
      signal: AbortSignal.timeout(CLASSIFY_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      kind: 'service',
      status: null,
      reason: error instanceof Error ? error.name : 'unreachable',
    };
  }
  if (!answer.ok) {
    return {
      ok: false,
      kind: failureKindFor(answer.status),
      status: answer.status,
      reason: `http ${answer.status}`,
    };
  }
  const parsed = readAnswer(await answer.json().catch(() => null));
  if (parsed === null) {
    return { ok: false, kind: 'service', status: answer.status, reason: 'unreadable answer' };
  }
  console.log(
    JSON.stringify({
      msg: 'moderation.classified',
      url: imageUrl,
      verdict: parsed.verdict,
      ms: Date.now() - startedAt,
    }),
  );
  return { ok: true, answer: parsed };
}

export function logClassifyFailure(
  failure: { kind: ClassifyFailureKind; status: number | null; reason: string },
  imageUrl: string,
): void {
  const line = {
    msg:
      failure.kind === 'service'
        ? 'moderation.classifier-unavailable'
        : 'moderation.image-rejected',
    url: imageUrl,
    status: failure.status,
    reason: failure.reason,
  };
  if (failure.kind === 'service') {
    console.error(JSON.stringify({ level: 'error', ...line }));
    return;
  }
  console.warn(JSON.stringify({ level: 'warn', ...line }));
}
