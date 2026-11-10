import { sessionTemplateFromDraft, type SessionTemplate } from '@ce-shared/sessionTemplate.mjs';
import {
  SESSION_TEMPLATE_LINK_MAX_LENGTH,
  decodeSessionTemplateLink,
  encodeSessionTemplateLink,
} from '@ce-shared/sessionTemplateLink.mjs';
import { applySessionTemplateToDraft } from './sessionWizardDraftState';
import { prose, realLengthSessionWizardDraft, sessionWizardTemplateProfiles } from './sessionWizardTemplate.testUtils';

const exportDraft = (draft: unknown): SessionTemplate => {
  const result = sessionTemplateFromDraft(draft);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.template;
};

describe('session template share links from real-length setup drafts', () => {
  it.each(Object.entries(sessionWizardTemplateProfiles()))(
    'carries a salon-sized draft with the %s profile through a link and back into a draft',
    async (_name, profile) => {
      const shared = exportDraft(realLengthSessionWizardDraft(profile));
      const encoded = await encodeSessionTemplateLink(shared);
      if (!encoded.ok) throw new Error(JSON.stringify(encoded));
      expect(encoded.fragment.length).toBeLessThanOrEqual(SESSION_TEMPLATE_LINK_MAX_LENGTH);
      expect(encoded.fragment).not.toMatch(/rxc-ra-salon|workers\.dev/);
      const decoded = await decodeSessionTemplateLink(encoded.fragment);
      expect(decoded).toEqual({ ok: true, template: shared });
      if (!decoded?.ok) return;
      expect(exportDraft(applySessionTemplateToDraft(decoded.template))).toEqual(shared);
    },
  );

  it('falls back to a .json download when a draft outgrows a link', async () => {
    const draft = realLengthSessionWizardDraft();
    draft.sessionContext.paragraphs = Array.from({ length: 6 }, (_entry, index) => prose(20 + index, 2000));
    draft.questions = Array.from({ length: 12 }, (_entry, index) => ({
      prompt: prose(40 + index, 1000),
      type: 'freeform',
    }));
    await expect(encodeSessionTemplateLink(exportDraft(draft))).resolves.toMatchObject({
      ok: false,
      reason: 'too_long',
    });
  });
});
