import {
  decorateUrls,
  extractUrls,
  findMedia,
  isImageMedia,
  isOwnMedia,
  isUrlRestricted,
  type ContentPart,
  type DetectedMedia,
  type EventType,
} from '@hiroba/shared';
import { decorateSmileys, type EmojiRenderOptions, type SmileyPart } from '../emoji/decorator';
import { mediaBase, siteOrigin } from '../runtime';

export type MessageLabelPart =
  { kind: 'text'; text: string } | { kind: 'smiley'; src: string; alt: string } | { kind: 'break' };

export type MessagePart =
  MessageLabelPart | { kind: 'link'; href: string; label: MessageLabelPart[] };

function smileyParts(text: string, options: EmojiRenderOptions): MessageLabelPart[] {
  return decorateSmileys(text, options).map((part: SmileyPart) =>
    part.kind === 'smiley'
      ? { kind: 'smiley' as const, src: part.src, alt: part.alt }
      : part.kind === 'break'
        ? { kind: 'break' as const }
        : { kind: 'text' as const, text: part.text },
  );
}

export function renderMessageContent(
  content: string,
  eventType: EventType,
  options: EmojiRenderOptions = {},
): MessagePart[] {
  const linked: ContentPart[] = decorateUrls(content, isUrlRestricted(eventType), siteOrigin());
  const parts: MessagePart[] = [];
  for (const part of linked) {
    if (part.kind === 'text') {
      parts.push(...smileyParts(part.text, options));
      continue;
    }
    parts.push({ kind: 'link', href: part.href, label: smileyParts(part.text, options) });
  }
  return parts;
}

export function mediaOfMessage(content: string, eventType: EventType): DetectedMedia | null {
  return findMedia(content, isUrlRestricted(eventType), {
    siteOrigin: siteOrigin(),
    mediaBase: mediaBase(),
  });
}

export function ownImageUrlOfMessage(content: string, eventType: EventType): string | null {
  const base = mediaBase();
  for (const url of extractUrls(content, isUrlRestricted(eventType), siteOrigin())) {
    if (isImageMedia(url) && isOwnMedia(url.toString(), base)) {
      return url.toString();
    }
  }
  return null;
}
