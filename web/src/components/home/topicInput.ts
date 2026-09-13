const UNSAFE_TOPIC_CHARS = '~`!@#$%^&*()+=[]{}\\/?\' "|,<>;:\t\n\r';

export function isSafeTopicChar(char: string): boolean {
  return !UNSAFE_TOPIC_CHARS.includes(char);
}

export function refusesTopicKey(event: {
  key: string;
  isComposing?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): boolean {
  if (event.isComposing === true || event.ctrlKey === true || event.metaKey === true) {
    return false;
  }
  if (event.altKey === true || event.key.length !== 1) {
    return false;
  }
  return !isSafeTopicChar(event.key);
}
