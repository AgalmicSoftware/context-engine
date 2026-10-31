import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_WRAPPED_IMAGE_MODEL } from './wrappedCore.mjs';
import { normalizeWrappedImageQuality } from './wrappedEvidence.mjs';
import { buildOpenAiWrappedImageFormData } from './wrappedImageRendering.mjs';

test('Wrapped posters use gpt-image-2.5-flare at a quality it accepts', () => {
  const form = buildOpenAiWrappedImageFormData({
    model: DEFAULT_WRAPPED_IMAGE_MODEL,
    prompt: 'Synthetic poster',
    size: '1536x1024',
    quality: normalizeWrappedImageQuality('low'),
  });
  assert.equal(form.get('model'), 'gpt-image-2.5-flare');
  // OpenAI documents low, medium, high, xhigh, max and auto for this model.
  assert.ok(['low', 'medium', 'high', 'xhigh', 'max', 'auto'].includes(form.get('quality')));
});
