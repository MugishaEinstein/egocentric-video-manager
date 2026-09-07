export const MIN_VIDEO_WIDTH = 1920;
export const MIN_VIDEO_HEIGHT = 1080;

export function isMinimum1080p(width: number, height: number) {
  return width >= MIN_VIDEO_WIDTH && height >= MIN_VIDEO_HEIGHT;
}

export function hasActionableRejectionComment(comment: string) {
  return comment.trim().length >= 10;
}
