export function sysSessionLost(status: number): boolean {
  return status === 401;
}

export function sysErrorMessage(status: number, atGate = false): string {
  if (status === 401) {
    return atGate ? 'authentication failed' : 'not authenticated';
  }
  return 'request failed: ' + status;
}
