import React, { useCallback, useEffect, useRef } from 'react';
import { readThemeToken, subscribeThemeChanges } from '../../utilities/ui/themeRuntime';
import styles from './SurveyTool.module.scss';

type BrowserAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type SessionListeningWaveformProps = {
  streamRef?: React.MutableRefObject<MediaStream | null>;
  isActive: boolean;
  isPaused: boolean;
};

const requestWaveformFrame = (callback: FrameRequestCallback) => {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  return window.setTimeout(() => callback(Date.now()), 33);
};

const cancelWaveformFrame = (handle: number) => {
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(handle);
    return;
  }
  window.clearTimeout(handle);
};

export function SessionListeningWaveform({ streamRef, isActive, isPaused }: SessionListeningWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const bufferLenRef = useRef(0);
  const ctx2dRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastDrawRef = useRef(0);
  const waveformColorsRef = useRef({ canvas: 'Canvas', bars: 'Highlight' });

  useEffect(() => {
    const refreshWaveformColors = () => {
      waveformColorsRef.current = {
        canvas: readThemeToken('ce-control-face', 'Canvas'),
        bars: readThemeToken('ce-action-primary', 'Highlight'),
      };
    };
    refreshWaveformColors();
    return subscribeThemeChanges(refreshWaveformColors);
  }, []);

  const sizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(canvas.clientWidth || 0, 260);
    const height = Math.max(canvas.clientHeight || 0, 80);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }, []);

  const drawWaveform = useCallback(function drawWaveform() {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) {
      animationRef.current = null;
      return;
    }

    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
    if (now - lastDrawRef.current < 33) {
      if (animationRef.current !== null) {
        animationRef.current = requestWaveformFrame(drawWaveform);
      }
      return;
    }
    lastDrawRef.current = now;

    let ctx = ctx2dRef.current;
    if (!ctx) {
      ctx = canvas.getContext('2d');
      ctx2dRef.current = ctx;
    }
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    if (!dataArrayRef.current || bufferLenRef.current !== bufferLength) {
      dataArrayRef.current = new Uint8Array(bufferLength);
      bufferLenRef.current = bufferLength;
    }
    const dataArray = dataArrayRef.current;
    analyser.getByteFrequencyData(dataArray);

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const visualHeight = Math.max(1, canvasHeight - 4);
    ctx.fillStyle = waveformColorsRef.current.canvas;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const barWidth = (canvasWidth / bufferLength) * 2.5;
    let peak = 0;
    for (let i = 0; i < bufferLength; i += 1) {
      if (dataArray[i] > peak) peak = dataArray[i];
    }
    const scale = peak > 0 ? visualHeight / Math.max(peak, 16) : 0;
    let x = 0;
    ctx.fillStyle = waveformColorsRef.current.bars;
    for (let i = 0; i < bufferLength; i += 1) {
      const barHeight = peak > 0 ? Math.max(2, Math.min(dataArray[i] * scale, visualHeight)) : 0;
      ctx.fillRect(x, canvasHeight - 2 - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }

    if (animationRef.current !== null) {
      animationRef.current = requestWaveformFrame(drawWaveform);
    }
  }, []);

  const clearRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const cleanupWaveform = useCallback(() => {
    clearRetry();
    if (animationRef.current !== null) {
      cancelWaveformFrame(animationRef.current);
      animationRef.current = null;
    }
    try {
      if (sourceNodeRef.current && analyserRef.current) {
        sourceNodeRef.current.disconnect(analyserRef.current);
      } else if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
      } else if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
    } catch (_) {
      // Best-effort audio graph cleanup.
    }
    sourceNodeRef.current = null;
    analyserRef.current = null;
    dataArrayRef.current = null;
    bufferLenRef.current = 0;
    ctx2dRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => undefined);
    }
    audioContextRef.current = null;
  }, [clearRetry]);

  const ensureWaveformSetup = useCallback(() => {
    if (!isActive || typeof window === 'undefined') return false;
    const stream = streamRef?.current;
    const canvas = canvasRef.current;
    if (!stream || !canvas) return false;
    const audioWindow = window as BrowserAudioWindow;
    const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextCtor) return false;

    try {
      sizeCanvas();
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContextCtor();
      }
      const audioContext = audioContextRef.current;
      if (!audioContext) return false;
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => undefined);
      }
      if (!analyserRef.current) {
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
      }
      if (!sourceNodeRef.current) {
        const analyser = analyserRef.current;
        if (!analyser) return false;
        const sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNodeRef.current = sourceNode;
        sourceNode.connect(analyser);
      }
      if (!isPaused && animationRef.current === null) {
        lastDrawRef.current = 0;
        animationRef.current = requestWaveformFrame(drawWaveform);
      }
      return true;
    } catch (_) {
      return false;
    }
  }, [drawWaveform, isActive, isPaused, sizeCanvas, streamRef]);

  useEffect(() => {
    if (!isActive) {
      cleanupWaveform();
      return undefined;
    }

    let cancelled = false;
    const trySetup = () => {
      if (cancelled) return;
      if (ensureWaveformSetup()) {
        clearRetry();
        return;
      }
      clearRetry();
      retryTimeoutRef.current = setTimeout(() => {
        retryTimeoutRef.current = null;
        trySetup();
      }, 50);
    };

    trySetup();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', sizeCanvas);
    }
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', sizeCanvas);
      }
      cleanupWaveform();
    };
  }, [cleanupWaveform, clearRetry, ensureWaveformSetup, isActive, sizeCanvas]);

  useEffect(() => {
    if (!isActive) return;
    if (isPaused) {
      if (animationRef.current !== null) {
        cancelWaveformFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }
    if (analyserRef.current && canvasRef.current && animationRef.current === null) {
      lastDrawRef.current = 0;
      animationRef.current = requestWaveformFrame(drawWaveform);
    }
  }, [drawWaveform, isActive, isPaused]);

  return <canvas ref={canvasRef} className={styles.sessionListeningWaveformCanvas} aria-hidden="true" />;
}
