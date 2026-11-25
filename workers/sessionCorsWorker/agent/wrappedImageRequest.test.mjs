import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_WRAPPED_IMAGE_MODEL } from './wrappedCore.mjs';
import { normalizeWrappedImageQuality } from './wrappedEvidence.mjs';
import { buildOpenAiWrappedImageFormData, buildWrappedStoryboardSvgBase64 } from './wrappedImageRendering.mjs';
import { saveAgentOnlyWrappedImage } from './wrappedImageStorage.mjs';
import { handleAgentOnlyWrappedImageViewRequest } from './wrapped.mjs';

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

test('a Wrapped image is served as a storage read is: no sniffing, and a sandbox that runs no script', async () => {
  const values = new Map();
  const env = {
    AGENT_ACTION_KV: { get: async (key) => values.get(key) ?? null, put: async (key, value) => { values.set(key, value); } },
    AGENT_CONTEXT: { sessionId: `0x${'3'.repeat(32)}`, slug: 'wrapped-fixture', now: () => Date.parse('2026-11-25T10:00:00Z') },
  };
  // A one-pixel PNG, drawn by the SVG form as its story frames.
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
  for (const [imageContentType, imageBase64] of [['image/png', png], ['image/svg+xml', buildWrappedStoryboardSvgBase64(png)]]) {
    const saved = await saveAgentOnlyWrappedImage({ env, sessionSlug: 'wrapped-fixture', telegramUserId: 'agent-1', mode: 'story',
      imageContentType, imageBase64, now: '2026-11-25T09:00:00Z' });
    assert.equal(saved.ok, true, JSON.stringify(saved));
    for (const method of ['GET', 'HEAD']) {
      const response = await handleAgentOnlyWrappedImageViewRequest({ env, imageViewId: saved.imageViewId, method });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), imageContentType);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('content-security-policy'), "sandbox; default-src 'none'; img-src data:");
    }
  }
});
