export const SMILEY_ABOVE_THRESHOLD_PX = 400;
export const SMILEY_ABOVE_OFFSET_PX = 155;
export const SMILEY_BELOW_OFFSET_PX = 25;

export interface IconRect {
  left: number;
  top: number;
}

export function smileyPosition(icon: IconRect): { left: number; top: number } {
  return {
    left: icon.left,
    top:
      icon.top > SMILEY_ABOVE_THRESHOLD_PX
        ? icon.top - SMILEY_ABOVE_OFFSET_PX
        : icon.top + SMILEY_BELOW_OFFSET_PX,
  };
}
