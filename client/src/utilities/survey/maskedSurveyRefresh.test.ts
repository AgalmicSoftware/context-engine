import { clearDecryptCaches } from '../crypto/cryptography';
import { createMaskedSurveyRefresh, type MaskedSurveyRefreshDeps } from './maskedSurveyRefresh';

type Survey = Record<string, unknown>;

const locked = (): Survey => ({ title: '[encrypted]', titleEncrypted: 'title-envelope' });
const unlock = async (survey: Survey) => {
  survey.title = 'Private title';
  survey.titleDecrypted = true;
};

const setup = (surveyIds: string[], decryptSurvey: MaskedSurveyRefreshDeps['decryptSurvey'] = unlock) => {
  const surveys: Record<string, Survey> = Object.fromEntries(surveyIds.map((id) => [id, locked()]));
  const deps = {
    readSurveys: jest.fn(() => ({ networkID: '84532', surveys: { ...surveys } })),
    buildDecryptContext: jest.fn(() => ({ account: '0xReader', providerLike: 'provider' })),
    decryptSurvey: jest.fn(decryptSurvey),
    saveSurveys: jest.fn(async (_slug: string, _networkID: string, update: (current: Survey) => void) => {
      update(surveys);
    }),
    onSaved: jest.fn(),
    logWarn: jest.fn(),
  };
  return { deps, surveys, refresher: createMaskedSurveyRefresh(deps) };
};

afterEach(() => {
  jest.useRealTimers();
});

describe('masked survey refresh', () => {
  it('decrypts locked surveys a few per run and saves them for their reader', async () => {
    jest.useFakeTimers();
    const ids = Array.from({ length: 10 }, (_, index) => `s${index}`);
    const { deps, surveys, refresher } = setup(ids);

    await refresher.refresh('alpha');
    expect(Object.values(surveys).filter((survey) => survey.titleDecrypted)).toHaveLength(8);

    await jest.advanceTimersByTimeAsync(200);
    expect(Object.values(surveys)).toEqual(
      ids.map(() => expect.objectContaining({ title: 'Private title', decryptedFor: '0xreader' })),
    );
    expect(deps.decryptSurvey).toHaveBeenCalledTimes(10);
    expect(deps.onSaved).toHaveBeenCalledTimes(2);
  });

  it('saves nothing when the account changes while it decrypts', async () => {
    const { deps, surveys, refresher } = setup(['s1'], async (survey) => {
      await unlock(survey);
      // AppShell clears the decrypt caches on every account change and sign-out.
      clearDecryptCaches();
    });

    await refresher.refresh('alpha');

    expect(deps.decryptSurvey).toHaveBeenCalledTimes(1);
    expect(deps.saveSurveys).not.toHaveBeenCalled();
    expect(surveys.s1).toEqual(locked());
  });

  it('retries a survey the reader cannot decrypt only when forced', async () => {
    const { deps, refresher } = setup(['s1'], async () => undefined);

    await refresher.refresh('alpha');
    await refresher.refresh('alpha');
    expect(deps.decryptSurvey).toHaveBeenCalledTimes(1);

    await refresher.refresh('alpha', { force: true });
    expect(deps.decryptSurvey).toHaveBeenCalledTimes(2);
    expect(deps.saveSurveys).not.toHaveBeenCalled();
  });
});
