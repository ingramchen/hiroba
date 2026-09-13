import type { TopicRow } from './types';

export const EMPTY_HOT: TopicRow[] = [
  { topic: 'slowmodetopic', label: 'localhost:8080/slowmodetopic', crowd: 0, messages: [] },
];

export const POPULATED_HOT: TopicRow[] = [
  { topic: 'slowmodetopic', label: 'localhost:8080/slowmodetopic', crowd: 0, messages: [] },
  {
    topic: 'reference',
    label: 'localhost:8080/reference',
    crowd: 0,
    messages: [
      '@viewer 這是回覆你的訊息',
      'https://www.youtube.com/watch?v=dQw4w9Wg...',
      'https://www.gstatic.com/webp/gallery/1.j...',
    ],
  },
];
