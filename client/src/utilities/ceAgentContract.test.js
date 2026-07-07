import { describeCeAgentContract } from './ceAgentContract.js';

describe('ceAgentContract', () => {
  it('describes the stable dev/e2e agent surface', () => {
    const contract = describeCeAgentContract();

    expect(contract).toMatchObject({
      version: 1,
      activation: {
        devOnly: true,
        route: '/agent',
        queryParam: 'agent=1',
        localStorageKey: 'ce-agent-enabled',
      },
      docs: {
        bootstrap: 'docs/ai-agent-bootstrap.md',
        testIdApi: 'docs/e2e-testid-api.md',
        e2eSetup: 'docs/e2e-setup.md',
      },
    });

    expect(contract.actions.map((action) => action.type)).toEqual([
      'navigate',
      'fill',
      'click',
      'assertVisible',
      'invokeAi',
    ]);
    expect(contract.tools.map((tool) => tool.name)).toEqual(['CompareAddresses', 'PolisReport']);
  });
});
