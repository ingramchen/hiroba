import { LIMITS, abbreviate, type SquareView } from '@hiroba/shared';
import type { TopicRow } from '../fixtures/types';

const TOPIC_LABEL_MAX = 50;
const MESSAGE_MAX = 40;
const MAX_THUMB_HEIGHT = 75;
const SCHEME = /[a-zA-Z]+:\/\//u;

function schemeless(url: string): string {
  return url.replace(SCHEME, '//');
}

export function toRow(view: SquareView, host: string): TopicRow {
  const row: TopicRow = {
    topic: view.topic,
    label: abbreviate(host + '/' + view.topic, TOPIC_LABEL_MAX),
    crowd: view.crowd,
    messages: view.latestMessages
      .slice(0, LIMITS.homeListMessages)
      .map((event) => abbreviate(event.content, MESSAGE_MAX)),
  };
  if (view.thumb !== null) {
    row.thumb = {
      src: schemeless(view.thumb.url),
      width: view.thumb.width,
      height: Math.min(view.thumb.height, MAX_THUMB_HEIGHT),
    };
  }
  return row;
}
