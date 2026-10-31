import {
  SESSION_TEMPLATE_FORMAT,
  sessionTemplateFromDraft,
  validateSessionTemplate,
  type SessionTemplate,
} from '@ce-shared/sessionTemplate.mjs';
import { applySessionTemplateToDraft, buildSessionWizardDefaultTemplate } from './sessionWizardDraftState';
import { realLengthSessionWizardDraft, sessionWizardTemplateProfiles } from './sessionWizardTemplate.testUtils';

const template = (value: unknown): SessionTemplate => {
  const result = validateSessionTemplate(value);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.template;
};
const exportDraft = (draft: unknown): SessionTemplate => {
  const result = sessionTemplateFromDraft(draft);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.template;
};
const defaults = () => template({ format: SESSION_TEMPLATE_FORMAT });

describe('session templates and the setup draft', () => {
  it('exports a fresh setup draft as exactly the template defaults', () => {
    expect(exportDraft(buildSessionWizardDefaultTemplate())).toEqual(defaults());
  });

  it.each(Object.entries(sessionWizardTemplateProfiles()))(
    'round-trips a real-length draft with the %s profile',
    (_name, profile) => {
      const draft = realLengthSessionWizardDraft(profile);
      const exported = exportDraft(draft);
      expect(exported.sessionModeProfile).toEqual(profile);
      expect(exported.sessionContext.paragraphs.join('').length).toBeGreaterThan(5000);
      expect(exportDraft(applySessionTemplateToDraft(exported))).toEqual(exported);
    },
  );

  it('keeps the base draft’s deployment fields and rebuilds storage from the imported profile', () => {
    const { cloudflare, decentralized } = sessionWizardTemplateProfiles();
    const shared = exportDraft(realLengthSessionWizardDraft(decentralized));
    const local = {
      ...realLengthSessionWizardDraft(cloudflare),
      slug: 'jess-salon',
      corsWorkerUrl: 'https://jess-salon.example.workers.dev',
      sessionId: `0x${'ab'.repeat(16)}`,
      networkChainId: 10,
      sessionName: 'Local name',
    };
    const imported = applySessionTemplateToDraft(shared, local);
    expect(imported).toMatchObject({
      slug: 'jess-salon',
      corsWorkerUrl: 'https://jess-salon.example.workers.dev',
      sessionId: `0x${'ab'.repeat(16)}`,
      networkChainId: 11155420,
      draftId: shared.draftId,
      sessionName: shared.sessionName,
      sessionModeProfile: decentralized,
    });
    expect(imported.storageProfile).toMatchObject({ backend: 'arweave' });
    expect(exportDraft(imported)).toEqual(shared);
  });

  it('keeps the base profile when the template has none and resets every other portable field', () => {
    const local = realLengthSessionWizardDraft(sessionWizardTemplateProfiles().publicWithAgents);
    const imported = applySessionTemplateToDraft(
      template({ format: SESSION_TEMPLATE_FORMAT, sessionName: 'Fresh' }),
      local,
    );
    expect(imported.corsWorkerUrl).toBe(local.corsWorkerUrl);
    expect(imported).not.toHaveProperty('draftId');
    expect(exportDraft(imported)).toEqual({
      ...defaults(),
      sessionName: 'Fresh',
      sessionModeProfile: local.sessionModeProfile,
    });
  });
});
