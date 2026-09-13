import type { MessagePart } from '../media/message';

export interface TopicThumb {
  src: string;
  width: number;
  height: number;
}

export interface TopicRow {
  topic: string;
  label: string;
  crowd: number;
  messages: string[];
  thumb?: TopicThumb;
}

export interface ChatRow {
  nickname: string;
  color: string;
  replyTo?: string;
  even: boolean;
  replyToMe?: boolean;
  anchor?: boolean;
  showColor?: string;
  forbidIcon?: boolean;
  senderPublicId?: string;
  time: string;
  parts: MessagePart[];
}

export type { MessageLabelPart, MessagePart } from '../media/message';
