const VIDEO_TYPES: Array<[string, 'mp4' | 'webm']> = [
  ['video/mp4;codecs=avc1.42E01E', 'mp4'],
  ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9', 'webm'],
  ['video/webm', 'webm'],
];

// The video format this browser can record from a canvas (MP4 where it can, otherwise WebM), or null when it
// cannot record one at all.
export const analysisCardVideoType = (): { mime: string; extension: 'mp4' | 'webm' } | null => {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined') return null;
  if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null;
  const found = VIDEO_TYPES.find(([mime]) => MediaRecorder.isTypeSupported(mime));
  return found ? { mime: found[0], extension: found[1] } : null;
};
