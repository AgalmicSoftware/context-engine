import { encodeLinkJson } from '@ce-shared/linkPayload.mjs';
import { parseSessionTemplateJson, validateSessionTemplate } from '@ce-shared/sessionTemplate.mjs';
import {
  SESSION_TEMPLATE_LINK_MAX_LENGTH,
  decodeSessionTemplateLink,
  encodeSessionTemplateLink,
} from '@ce-shared/sessionTemplateLink.mjs';
import { salonExportedTemplateFields, salonSetupTemplateFields } from '../sessionWizardTemplate.testUtils';
import {
  SESSION_SETUP_AI_APPS,
  SESSION_SETUP_EXAMPLE,
  SESSION_SETUP_LINK_JSON_LIMIT,
  buildSessionSetupKickoff,
} from './sessionSetupKickoff';

const SETUP_URL = 'https://contextengine.sh/new';
const prompt = buildSessionSetupKickoff({ setupUrl: SETUP_URL });
// The template fields the prompt may name, and the question fields inside them.
const PROMPT_FIELDS = new Set([
  'format',
  'sessionName',
  'sessionInfo',
  'sessionEndsAt',
  'sessionContext',
  'title',
  'paragraphs',
  'links',
  'label',
  'url',
  'questionsGenPrompt',
  'questions',
  'groupCreationPolicy',
  'interviewModeEnabled',
  'interviewMode',
  'openingMode',
  'openingPrompt',
  'steeringPrompt',
  'prompt',
  'type',
  'tags',
  'scale',
  'min',
  'max',
  'minLabel',
  'maxLabel',
  'options',
  'singleSelect',
  'voiceCredits',
]);
const setupLink = (fields: unknown) => `#setup=${encodeLinkJson(fields)}`;

describe('the "Set up with your AI" prompt', () => {
  it('asks about the session, then states the template shape, the size rule and the link back', () => {
    for (const topic of ['the goal', 'how people take part', 'who should see the results', 'timing', 'links']) {
      expect(prompt).toContain(topic);
    }
    expect(prompt).toContain('"format": "ce.session-template/v1"');
    expect(prompt).toContain(`at most ${SESSION_SETUP_LINK_JSON_LIMIT.toLocaleString('en-US')} characters`);
    expect(prompt).toContain(`${SETUP_URL}#setup=ENCODED`);
    expect(prompt).toContain('Import → Or paste it');
    expect(prompt).toMatch(/Never put API keys, tokens, passwords/);
    expect(prompt).toMatch(/Leave out models, AI providers, hosting, sign-in and encryption/);
  });

  it('names only template fields, leaving out models, profiles and draft IDs', () => {
    const named = [...prompt.matchAll(/"(\w+)":/g)].map((match) => match[1]);
    expect(named.filter((field) => !PROMPT_FIELDS.has(field))).toEqual([]);
    expect(prompt).not.toMatch(/"(ai|models|sessionModeProfile|draftId|realtimeModel|contextFiles)"/);
  });

  it('gives an example that validates and opens from a #setup= link', async () => {
    expect(prompt).toContain(JSON.stringify(SESSION_SETUP_EXAMPLE));
    const expected = validateSessionTemplate(SESSION_SETUP_EXAMPLE);
    expect(expected.ok).toBe(true);
    await expect(decodeSessionTemplateLink(setupLink(SESSION_SETUP_EXAMPLE))).resolves.toEqual(expected);
  });

  it('opens in ChatGPT or Claude with the whole prompt, within URL limits', () => {
    for (const app of SESSION_SETUP_AI_APPS) {
      const url = new URL(app.url(prompt));
      expect(url.protocol).toBe('https:');
      expect(url.searchParams.get('q')).toBe(prompt);
      expect(app.url(prompt).length).toBeLessThan(14000);
    }
  });
});

describe('templates an AI returns', () => {
  it('a salon-sized setup (28 questions) is too long for a #setup= link, so it is pasted, and imports', async () => {
    const fields = salonSetupTemplateFields();
    const json = JSON.stringify(fields);
    expect(json.length).toBeGreaterThan(SESSION_SETUP_LINK_JSON_LIMIT);
    const pasted = parseSessionTemplateJson(JSON.stringify(fields, null, 2));
    if (!pasted.ok) throw new Error(JSON.stringify(pasted.errors));
    expect(pasted.template.questions).toHaveLength(28);
    // The link still opens if the AI makes one anyway.
    const link = setupLink(fields);
    expect(link.length).toBeGreaterThan(SESSION_TEMPLATE_LINK_MAX_LENGTH);
    await expect(decodeSessionTemplateLink(link)).resolves.toEqual(pasted);
  });

  it('a shorter setup fits a #setup= link of about 8,000 characters', async () => {
    const fields = { ...salonSetupTemplateFields() };
    fields.questions = fields.questions.slice(0, 8);
    fields.interviewMode = { openingMode: 'auto' };
    const json = JSON.stringify(fields);
    expect(json.length).toBeLessThanOrEqual(SESSION_SETUP_LINK_JSON_LIMIT);
    const link = setupLink(fields);
    expect(link.length).toBeLessThanOrEqual(SESSION_TEMPLATE_LINK_MAX_LENGTH + 100);
    const decoded = await decodeSessionTemplateLink(link);
    expect(decoded).toEqual(validateSessionTemplate(fields));
    expect(decoded?.ok).toBe(true);
  });

  it('records both link lengths for the 28-question template as the page exports it', async () => {
    const exported = validateSessionTemplate(salonExportedTemplateFields());
    if (!exported.ok) throw new Error(JSON.stringify(exported.errors));
    const shared = await encodeSessionTemplateLink(exported.template);
    if (!shared.ok) throw new Error(JSON.stringify(shared));
    const plain = setupLink(exported.template);
    // 4,504 and 13,427 characters. A real one is about 5,300 and 13,400: seeded prose deflates a little better.
    expect(shared.fragment.length).toBeGreaterThan(4000);
    expect(shared.fragment.length).toBeLessThanOrEqual(SESSION_TEMPLATE_LINK_MAX_LENGTH);
    expect(plain.length).toBeGreaterThan(12000);
    expect(plain.length).toBeLessThan(15000);
    await expect(decodeSessionTemplateLink(shared.fragment)).resolves.toEqual(exported);
    await expect(decodeSessionTemplateLink(plain)).resolves.toEqual(exported);
  });

  it('a template with a secret, an unknown field or a wrong type is refused, naming each field', async () => {
    const decoded = await decodeSessionTemplateLink(
      setupLink({
        ...SESSION_SETUP_EXAMPLE,
        sessionInfo: `Use my key sk-proj-${'a1B2'.repeat(8)}`,
        colour: 'green',
        interviewModeEnabled: 'yes',
      }),
    );
    expect(decoded?.ok).toBe(false);
    if (decoded?.ok !== false) return;
    expect(decoded.errors.map((error) => error.path).sort()).toEqual(['colour', 'interviewModeEnabled', 'sessionInfo']);
  });
});
