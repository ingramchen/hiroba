export interface FittedSize {
  width: number;
  height: number;
}

export function fitSize(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number,
): FittedSize {
  let width = naturalWidth;
  let height = naturalHeight;
  for (let pass = 0; pass < 2; pass++) {
    if (width > maxWidth) {
      height = Math.trunc((maxWidth / width) * height);
      width = maxWidth;
    } else if (height > maxHeight) {
      width = Math.trunc((maxHeight / height) * width);
      height = maxHeight;
    }
  }
  return { width, height };
}
