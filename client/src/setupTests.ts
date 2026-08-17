import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

jest.mock('react-dom/test-utils', () => {
  const React = jest.requireActual('react');
  const testUtils = jest.requireActual('react-dom/test-utils');
  return {
    ...testUtils,
    act: React.act || testUtils.act,
  };
});

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => ({
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
    measureText: () => ({ width: 0 }),
    transform: () => {},
    rect: () => {},
    clip: () => {},
  });
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,canvas-mock';
}

jest.mock('./utilities/useWhisper.js', () => ({
  __esModule: true,
  RECORDING_STATUS: {
    IDLE: 'idle',
    REQUESTING_PERMISSION: 'requesting_permission',
    PERMISSION_DENIED: 'permission_denied',
    READY: 'ready',
    RECORDING: 'recording',
    PAUSED: 'paused',
    PROCESSING: 'processing',
    STREAMING: 'streaming',
    ERROR: 'error',
  },
  useWhisper: () => ({
    status: 'idle',
    isRecording: false,
    isPaused: false,
    isProcessing: false,
    isStreaming: false,
    transcript: { live: '', final: '' },
    errorMessage: '',
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    pauseRecording: jest.fn(),
    resumeRecording: jest.fn(),
    audioContextRef: { current: null },
    mediaStreamRef: { current: null },
    lastRecordingBlobRef: { current: { blob: null, mimeType: '' } },
    getLastRecordingBlob: jest.fn(() => null),
  }),
}));

jest.mock('d3', () => {
  const chain = () => {
    const fn = jest.fn();
    fn.domain = () => fn;
    fn.range = () => fn;
    fn.ticks = () => [];
    return fn;
  };

  const buildHierarchyNode = (data, childrenAccessor, depth = 0, parent = null) => {
    const childrenData = childrenAccessor ? childrenAccessor(data) : null;
    const node = {
      data,
      depth,
      parent,
      children: null,
      value: 0,
      x: 0,
      y: 0,
      r: 0,
      descendants() {
        return [this, ...(this.children || []).flatMap((child) => child.descendants())];
      },
      sum(valueAccessor) {
        const ownValue = Number(valueAccessor ? valueAccessor(this.data) : 0) || 0;
        const childValue = (this.children || []).reduce((sum, child) => {
          child.sum(valueAccessor);
          return sum + (Number(child.value) || 0);
        }, 0);
        this.value = ownValue + childValue;
        return this;
      },
      sort(compare) {
        if (Array.isArray(this.children) && this.children.length > 0) {
          this.children.sort(compare);
          this.children.forEach((child) => child.sort(compare));
        }
        return this;
      },
    };

    const childNodes = Array.isArray(childrenData)
      ? childrenData.map((child) => buildHierarchyNode(child, childrenAccessor, depth + 1, node))
      : null;

    node.children = childNodes;

    return node;
  };

  const hierarchy = (data, childrenAccessor) => buildHierarchyNode(data, childrenAccessor);

  const pack = () => {
    let currentSize = [1, 1];
    let currentPadding = 0;

    const layoutNode = (node, x, y, radius) => {
      node.x = x;
      node.y = y;
      node.r = radius;

      if (!Array.isArray(node.children) || node.children.length === 0) {
        return node;
      }

      const count = node.children.length;
      const childTotal = node.children.reduce((sum, child) => sum + Math.max(Number(child.value) || 0, 1), 0);
      const availableRadius = Math.max(radius - currentPadding - 6, 1);
      const ringDistanceBase = Math.max(radius - currentPadding - 10, 0);

      node.children.forEach((child, index) => {
        const weight = Math.max(Number(child.value) || 0, 1) / Math.max(childTotal, 1);
        const childRadius =
          count === 1
            ? availableRadius * 0.72
            : Math.max(availableRadius * 0.16, availableRadius * 0.68 * Math.sqrt(weight));
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
        const distance = count === 1 ? 0 : Math.max(ringDistanceBase - childRadius, 0) * 0.45;

        layoutNode(
          child,
          x + Math.cos(angle) * distance,
          y + Math.sin(angle) * distance,
          Math.min(childRadius, availableRadius),
        );
      });

      return node;
    };

    const packLayout = (root) => {
      const rootRadius = Math.max(Math.min(currentSize[0], currentSize[1]) / 2, 1);
      return layoutNode(root, currentSize[0] / 2, currentSize[1] / 2, rootRadius);
    };

    packLayout.size = (next) => {
      if (next === undefined) return currentSize;
      currentSize = Array.isArray(next) ? next : currentSize;
      return packLayout;
    };

    packLayout.padding = (next) => {
      if (next === undefined) return currentPadding;
      currentPadding = Number(next) || 0;
      return packLayout;
    };

    return packLayout;
  };

  const forceWithStrength = () => {
    const force = {
      strength: jest.fn(() => force),
    };
    return force;
  };
  const forceSimulation = jest.fn(() => {
    const simulation = {
      force: jest.fn(() => simulation),
      stop: jest.fn(() => simulation),
      tick: jest.fn(() => simulation),
    };
    return simulation;
  });

  return {
    __esModule: true,
    scaleLinear: chain,
    scaleOrdinal: chain,
    line: chain,
    polygonHull: jest.fn(() => null),
    min: jest.fn(() => 0),
    max: jest.fn(() => 0),
    schemeCategory10: [],
    schemeTableau10: [],
    color: jest.fn(),
    forceCollide: jest.fn(() => ({})),
    forceSimulation,
    forceX: jest.fn(forceWithStrength),
    forceY: jest.fn(forceWithStrength),
    hierarchy,
    pack,
  };
});

jest.mock('node:os', () => require('os'), { virtual: true });
jest.mock('node:events', () => require('events'), { virtual: true });
