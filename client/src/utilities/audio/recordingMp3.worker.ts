// @breezystack/lamejs 1.2.7 (LGPL-3.0): licenses, source and rebuild instructions
// are distributed at /licenses/lamejs/README.txt. Project glue remains MPL-2.0.
import { Mp3Encoder } from '@breezystack/lamejs';

const encoder = new Mp3Encoder(1, 44100, 128);
const output: Uint8Array<ArrayBuffer>[] = [];

self.onmessage = ({ data }: MessageEvent<{ pcm?: ArrayBuffer; finish?: boolean }>) => {
  try {
    if (data.finish) {
      output.push(new Uint8Array(encoder.flush()));
      self.postMessage({ audio: new Blob(output, { type: 'audio/mpeg' }) });
      return;
    }
    const pcm = new Int16Array(data.pcm!);
    for (let start = 0; start < pcm.length; start += 1152) {
      const encoded = encoder.encodeBuffer(pcm.subarray(start, start + 1152));
      if (encoded.length) output.push(new Uint8Array(encoded));
    }
    self.postMessage({ ready: true });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'MP3 encoding failed.' });
  }
};
