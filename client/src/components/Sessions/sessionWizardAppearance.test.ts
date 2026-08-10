import {
  buildSessionWizardWorkerConfigPayload,
  sanitizeSessionWizardMetadataPayload,
} from './sessionWizardWriteNormalization';

describe('session wizard appearance publication', () => {
  test('publishes only the normalized color scheme id to metadata and worker config', () => {
    const appearance = {
      colorSchemeId: 'ocean',
      '--ce-session-accent': '#ffffff',
      stylesheet: 'https://example.invalid/theme.css',
    };

    expect(sanitizeSessionWizardMetadataPayload({ appearance }).appearance).toEqual({ colorSchemeId: 'ocean' });
    expect(buildSessionWizardWorkerConfigPayload({ draft: { appearance } }).appearance).toEqual({
      colorSchemeId: 'ocean',
    });
  });

  test('falls back for missing or invalid ids and removes the superseded theme shape', () => {
    expect(
      sanitizeSessionWizardMetadataPayload({ appearance: {} }).appearance,
    ).toEqual({ colorSchemeId: 'context-engine' });
    expect(
      sanitizeSessionWizardMetadataPayload({
        appearance: { colorSchemeId: 'url(https://example.invalid/theme.css)' },
        theme: { id: 'classic-95', brand: { primary: '#abcdef' } },
      }),
    ).toEqual(expect.objectContaining({ appearance: { colorSchemeId: 'context-engine' } }));
    expect(
      sanitizeSessionWizardMetadataPayload({
        theme: { id: 'classic-95', brand: { primary: '#abcdef' } },
      }),
    ).not.toHaveProperty('theme');
  });
});
