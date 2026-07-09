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
    });
  });

  it('returns only the OpenAI secret field for ai resources', () => {
    expect(
      resolveSessionWizardResourceSecretFields('ai', {
        models: {
          fast: { provider: 'anthropic' },
          thinking: { provider: 'openrouter' },
        },
      }).map((field) => field.key),
    ).toEqual(['openaiKey']);
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
    expect(RESOURCE_SECTION_TOOLTIPS.ai).toMatch(/OpenAI key/i);
    expect(RESOURCE_SECTION_TOOLTIPS.rpc).toMatch(/Authenticated RPC endpoint/i);
    expect(RESOURCE_SECTION_TOOLTIPS.lit).toMatch(/Paste one Lit API key/i);
  });
});
