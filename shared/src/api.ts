export interface ApiError {
  error: string;
}

// what the storage routes answer with on a 4xx/5xx; the client reads `type`
// to tell a too-large refusal (which carries the limit) from any other failure
export const STORE_FAILED_TYPE = 'StoreException';
export const STORE_TOO_LARGE_TYPE = 'StoreTooLargeException';

export interface StoreFailure {
  type: string;
  message: string;
}

export interface StoreTooLargeFailure extends StoreFailure {
  type: typeof STORE_TOO_LARGE_TYPE;
  limitInBytes: number;
}

export function isStoreTooLargeFailure(body: unknown): body is StoreTooLargeFailure {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const failure = body as { type?: unknown; limitInBytes?: unknown };
  return failure.type === STORE_TOO_LARGE_TYPE && typeof failure.limitInBytes === 'number';
}
