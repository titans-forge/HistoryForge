export const MAX_CANVAS_SIDE = 8192;
export const MAX_CANVAS_PIXELS = 16 * 1024 * 1024;

export function canvasResolution(width, height, pixelRatio = 1) {
  const w = Number.isFinite(width) && width > 0 ? width : 1;
  const h = Number.isFinite(height) && height > 0 ? height : 1;
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0
    ? Math.min(pixelRatio, 2) : 1;
  const scale = Math.min(
    ratio, MAX_CANVAS_SIDE / w, MAX_CANVAS_SIDE / h,
    Math.sqrt(MAX_CANVAS_PIXELS / w / h),
  );
  return {
    width: Math.max(1, Math.min(MAX_CANVAS_SIDE, Math.floor(w * scale))),
    height: Math.max(1, Math.min(MAX_CANVAS_SIDE, Math.floor(h * scale))),
  };
}
