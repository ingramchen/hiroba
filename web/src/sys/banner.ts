export interface AddressBearing {
  address: string;
}

export function sharedAddressOf(chatters: readonly AddressBearing[]): string | null {
  if (chatters.length < 2) {
    return null;
  }
  const first = chatters[0]?.address ?? '';
  if (first.length === 0) {
    return null;
  }
  return chatters.every((chatter) => chatter.address === first) ? first : null;
}
