import {
  RESOURCE_LABELS,
  RESOURCE_SECTION_TOOLTIPS,
  resolveSessionWizardAiModelProviders,
  resolveSessionWizardResourceSecretFields,
} from './sessionWizardResourceConfig';

describe('sessionWizardResourceConfig', () => {
  it('resolves normalized ai model providers', () => {
    expect(
      resolveSessionWizardAiModelProviders({
        models: {
          fast: { provider: 'Anthropic' },
          thinking: { provider: 'openrouter' },
        },
      }),
    ).toEqual({
      fastProvider: 'anthropic',
      thinkingProvider: 'openrouter',
      transcriptionProvider: 'openai',
    });
  });

  it('returns the default OpenAI secret field when no model providers are selected', () => {
    expect(resolveSessionWizardResourceSecretFields('ai', null).map((field) => field.key)).toEqual(['openaiKey']);
  });

  it('returns the secret fields selected by the AI models', () => {
    expect(
      resolveSessionWizardResourceSecretFields('ai', {
        models: {
          fast: { provider: 'anthropic' },
          thinking: { provider: 'openrouter' },
        },
      }).map((field) => field.key),
    ).toEqual(['anthropicKey', 'openrouterKey', 'openaiKey']);
  });

  it('returns non-ai secret fields without mutation', () => {
    const first = resolveSessionWizardResourceSecretFields('rpc', null);
    const second = resolveSessionWizardResourceSecretFields('rpc', null);
    expect(first).toEqual([{ key: 'customRpcUrl', label: 'Custom RPC URL', type: 'text', placeholder: 'https://...' }]);
    expect(first).not.toBe(second);
  });

  it('keeps the /new Lit secret surface to one account authority field', () => {
    expect(resolveSessionWizardResourceSecretFields('lit', null).map((field) => field.key)).toEqual([
      'litAccountApiKey',
    ]);
  });

  it('exposes resource labels and tooltips', () => {
    expect(RESOURCE_LABELS.ai).toBe('AI');
    expect(RESOURCE_SECTION_TOOLTIPS.ai).toMatch(/provider key/i);
    expect(RESOURCE_SECTION_TOOLTIPS.rpc).toMatch(/Authenticated RPC endpoint/i);
    expect(RESOURCE_SECTION_TOOLTIPS.lit).toMatch(/Paste one Lit API key/i);
  });
});
