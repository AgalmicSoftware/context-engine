// Saves a personal analysis card from the page: as a picture (both pages side by side, or one page), as a
// looping GIF, or as a short video that slides from page 1 to page 2. Everything is made in the browser from
// the two drawn pages.
import { downloadBrowserFile } from '../sessionResultsExport/sessionResultsExport';
import { CARD_HEIGHT, CARD_WIDTH, type AnalysisCardPages } from './analysisCardCanvas';
import { analysisCardVideoType } from './analysisCardVideoType';
import { encodeGif, type GifFrame } from './gifEncoder';

export type AnalysisCardDownload = 'both' | 'page1' | 'page2' | 'gif' | 'video';
export type AnalysisCardFile = { blob: Blob; filename: string };

const HOLD_FIRST_MS = 2200;
const SLIDE_MS = 600;
const HOLD_SECOND_MS = 2800;
const GIF_SCALE = 0.5;
const GIF_SLIDE_FRAMES = 7;
const VIDEO_FPS = 30;
// How far page 2 has slid in (0 to 1) at a moment of the video: page 1 holds, slides away, page 2 holds.
export const slideProgressAt = (ms: number): number => {
  const part = Math.max(0, Math.min(1, (ms - HOLD_FIRST_MS) / SLIDE_MS));
  return part < 0.5 ? 2 * part * part : 1 - 2 * (1 - part) * (1 - part);
};
export const ANALYSIS_CARD_VIDEO_MS = HOLD_FIRST_MS + SLIDE_MS + HOLD_SECOND_MS;

const canvasOf = (width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser cannot draw the card.');
  return [canvas, context];
};

const drawSlide = (
  context: CanvasRenderingContext2D,
  pages: AnalysisCardPages,
  progress: number,
  scale: number,
): void => {
  const width = CARD_WIDTH * scale;
  const height = CARD_HEIGHT * scale;
  context.drawImage(pages.page1, -progress * width, 0, width, height);
  if (progress > 0) context.drawImage(pages.page2, (1 - progress) * width, 0, width, height);
};

const pngOf = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be made.'))), 'image/png');
  });

const makePicture = (pages: AnalysisCardPages, kind: 'both' | 'page1' | 'page2'): Promise<Blob> => {
  if (kind === 'page1') return pngOf(pages.page1);
  if (kind === 'page2') return pngOf(pages.page2);
  const [canvas, context] = canvasOf(CARD_WIDTH * 2, CARD_HEIGHT);
  context.drawImage(pages.page1, 0, 0);
  context.drawImage(pages.page2, CARD_WIDTH, 0);
  return pngOf(canvas);
};

// Page 1, a slide to page 2, page 2, and a slide back, so the loop has no jump.
const makeGif = (pages: AnalysisCardPages): Blob => {
  const width = CARD_WIDTH * GIF_SCALE;
  const height = CARD_HEIGHT * GIF_SCALE;
  const [, context] = canvasOf(width, height);
  const frame = (progress: number, delayMs: number): GifFrame => {
    drawSlide(context, pages, progress, GIF_SCALE);
    return { pixels: context.getImageData(0, 0, width, height).data, delayMs };
  };
  const steps = Array.from({ length: GIF_SLIDE_FRAMES }, (_, index) =>
    slideProgressAt(HOLD_FIRST_MS + ((index + 1) * SLIDE_MS) / (GIF_SLIDE_FRAMES + 1)),
  );
  const delay = SLIDE_MS / (GIF_SLIDE_FRAMES + 1);
  const frames = [
    frame(0, HOLD_FIRST_MS),
    ...steps.map((progress) => frame(progress, delay)),
    frame(1, HOLD_SECOND_MS),
    ...steps
      .slice()
      .reverse()
      .map((progress) => frame(progress, delay)),
  ];
  return new Blob([encodeGif(width, height, frames)], { type: 'image/gif' });
};

// Records the card's canvas while it plays once, in real time.
const makeVideo = (pages: AnalysisCardPages): Promise<{ blob: Blob; extension: string }> => {
  const type = analysisCardVideoType();
  if (!type) return Promise.reject(new Error('This browser cannot record a video.'));
  const [canvas, context] = canvasOf(CARD_WIDTH, CARD_HEIGHT);
  drawSlide(context, pages, 0, 1);
  const stream = canvas.captureStream(VIDEO_FPS);
  const recorder = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 8_000_000 });
  const parts: Blob[] = [];
  return new Promise((resolve, reject) => {
    const stopTracks = (): void => stream.getTracks().forEach((track) => track.stop());
    recorder.ondataavailable = (event) => {
      if (event.data.size) parts.push(event.data);
    };
    recorder.onerror = () => {
      stopTracks();
      reject(new Error('The video could not be recorded.'));
    };
    recorder.onstop = () => {
      stopTracks();
      resolve({ blob: new Blob(parts, { type: type.mime.split(';')[0] }), extension: type.extension });
    };
    recorder.start();
    const started = performance.now();
    // A timer, not animation frames, so the recording finishes even if the tab is put in the background.
    const timer = setInterval(() => {
      const elapsed = performance.now() - started;
      drawSlide(context, pages, slideProgressAt(elapsed), 1);
      if (elapsed >= ANALYSIS_CARD_VIDEO_MS) {
        clearInterval(timer);
        recorder.stop();
      }
    }, 1000 / VIDEO_FPS);
  });
};

export const makeAnalysisCardFile = async (
  pages: AnalysisCardPages,
  kind: AnalysisCardDownload,
): Promise<AnalysisCardFile> => {
  if (kind === 'gif') return { blob: makeGif(pages), filename: 'analysis-card.gif' };
  if (kind === 'video') {
    const video = await makeVideo(pages);
    return { blob: video.blob, filename: `analysis-card.${video.extension}` };
  }
  const name = { both: 'analysis-card', page1: 'analysis-card-page-1', page2: 'analysis-card-page-2' }[kind];
  return { blob: await makePicture(pages, kind), filename: `${name}.png` };
};

export const downloadAnalysisCard = async (pages: AnalysisCardPages, kind: AnalysisCardDownload): Promise<void> => {
  const { blob, filename } = await makeAnalysisCardFile(pages, kind);
  downloadBrowserFile({ content: blob, filename, mimeType: blob.type });
};
