import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyTool from './SurveyTool';
import contractScripts from '../../utilities/web3/chainGateway.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import { clearDecryptCaches } from '../../utilities/crypto/cryptography';

type EnsureQuestionCached = (questionId: string) => Promise<void>;

let mockEnsureQuestionCached: EnsureQuestionCached | null = null;
jest.mock('./SurveyPileViewMode', () => ({
  __esModule: true,
  PileViewMode: ({ ensureQuestionCached }: { ensureQuestionCached: EnsureQuestionCached }) => {
    mockEnsureQuestionCached = ensureQuestionCached;
    return <div data-testid="mock-question-pile" />;
  },
}));
jest.mock('./SurveySelector', () => ({ SurveySelector: () => null }));
jest.mock('./SurveyResults', () => ({ __esModule: true, default: () => null }));

const sessionConfig = {
  slug: 'edge',
  networkChainId: 84532,
  __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
};
const decryptedQuestion = () => ({ type: 'freeform', prompt: 'Private prompt', promptDecrypted: true });

let stored: Record<string, any> = {};
const ensureCachedOnMiss = async (questionId: string) => {
  render(
    <SurveyTool
      minifiedMode="pile"
      account="0xReader"
      network={{ id: 84532 }}
      sessionSlug="edge"
      sessionSlugPinned={true}
      sessionConfig={sessionConfig}
    />,
  );
  await screen.findByTestId('mock-question-pile');
  await mockEnsureQuestionCached!(questionId);
};

beforeEach(() => {
  stored = {};
  jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(null);
  jest.spyOn(cacheScripts, 'updateCacheAtomic').mockImplementation(async (_namespace, _slug, update) => {
    stored = (await update!(stored)) as Record<string, any>;
    return stored;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SurveyTool question cache miss', () => {
  it('saves a decrypted question for the reader it was decrypted for', async () => {
    jest.spyOn(contractScripts as any, 'getQuestionData').mockResolvedValue(decryptedQuestion());

    await ensureCachedOnMiss('q1');

    expect(stored['84532'].questions.q1).toMatchObject({ prompt: 'Private prompt', decryptedFor: '0xreader' });
  });

  it('drops a question decrypted before the account changed', async () => {
    jest.spyOn(contractScripts as any, 'getQuestionData').mockImplementation(async () => {
      // AppShell clears the decrypt caches on every account change and sign-out.
      clearDecryptCaches();
      return decryptedQuestion();
    });

    await ensureCachedOnMiss('q1');

    expect(contractScripts.getQuestionData).toHaveBeenCalled();
    expect(JSON.stringify(stored)).not.toContain('Private prompt');
  });
});
