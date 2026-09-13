import type { ChatroomType } from '@hiroba/shared';

export function isUploadEnabled(roomType: ChatroomType, anchorable: boolean): boolean {
  return roomType === 'ANCHOR_SQUARE' ? anchorable : roomType === 'FREE';
}
