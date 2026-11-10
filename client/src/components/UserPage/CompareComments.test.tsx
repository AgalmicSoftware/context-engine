import { fireEvent, render, screen } from '@testing-library/react';
import { buildResponsePayload } from '../SurveyTool/surveyToolResponsePayloadController';
import { buildUsersFromCaches } from '../../utilities/survey/compareUsers';
import { runCompareToolkit } from '../../utilities/ai/aiClient';
import { fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';
import ComparePresentation from './ComparePresentation';

jest.mock('../../utilities/ai/aiSettings.js', () => ({
  getEffectiveAiConfig: jest.fn(async () => ({ provider: 'openai', model: 'gpt-4o-mini', apiKeySource: 'worker' })),
}));
jest.mock('../../utilities/worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(async () => 'https://worker.example.test'),
}));
jest.mock('../../utilities/worker/workerAuth.js', () => ({ fetchWorkerWithAuth: jest.fn() }));

const address = '0x0000000000000000000000000000000000000001';
const question = { id: 'q1', type: 'binary', prompt: 'Keep a public explanation?' };
const publicComment = 'A public explanation makes the decision easier to understand.';
const privateComment = 'This explanation is private.';

describe.each(['question', 'survey'])('%s comparison comments', (path) => {
  it.each(['public', 'encrypted', 'masked'])(
    'passes only visible %s comments to AI and expanded details',
    async (visibility) => {
      jest
        .mocked(fetchWorkerWithAuth)
        .mockReset()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ completion: JSON.stringify({ agreements: ['Shared view.'], disagreements: [] }) }),
        } as Response);
      const payload = buildResponsePayload({
        isStandalone: path === 'question',
        singleQuestionMode: path === 'question',
        surveyId: 's1',
        account: address,
        surveyIndex: 0,
        surveyResponseState: {
          answers: { q1: { value: 'Agree' } },
          additionalComments: {
            q1: {
              value: visibility === 'public' ? publicComment : visibility === 'masked' ? '*' : privateComment,
              encrypted: visibility === 'encrypted',
            },
          },
          importance: {},
          conviction: {},
        },
        questionPool: [question],
        pileQuestions: [],
        resolveFieldEncryptionAudience: () => 'self',
        getQuestionEncryptionGates: () => [],
        resolveFieldEncryptionGateId: () => null,
        normalizeFieldAudienceMode: () => 'default',
        getSurveyMetadataForJson: () => ({ surveyTitle: 'Fixture survey', sessionName: 'fixture' }),
        resolveSessionContext: () => ({ sessionName: 'fixture' }),
        getConvictionFromSlice: () => null,
        getImportanceFromSlice: () => null,
        sanitizeQuestionPromptForResponsePayload: (q) => String(q.prompt || ''),
      });
      const response = path === 'question' ? payload : payload.responses![0];
      expect(response.additional).toMatchObject({ encrypted: visibility === 'encrypted' });
      const users = buildUsersFromCaches(
        [address],
        [],
        [
          {
            1: {
              questions: { q1: question },
              ...(path === 'question' ? { questionResponses: { q1: { [address]: JSON.stringify(payload) } } } : {}),
            },
          },
        ],
        path === 'survey' ? [{ 1: { surveyResponses: { s1: { [address]: JSON.stringify(payload) } } } }] : [],
      );
      expect(users[0].questions).toHaveLength(1);
      expect(users[0].questions[0].additionalComment).toBe(visibility === 'public' ? publicComment : undefined);
      await runCompareToolkit('compare', { users, sessionSlug: 'fixture' });
      expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
      const body = JSON.parse(String(jest.mocked(fetchWorkerWithAuth).mock.calls[0][1]?.body));
      const request = JSON.stringify(body);
      if (visibility === 'public') expect(request).toContain(publicComment);
      else expect(request).not.toContain(privateComment);
      const prompt = body.messages.find((message: { role: string }) => message.role === 'user').content;
      const envelope = JSON.parse(prompt.split('ENVELOPE (JSON):')[1]);
      expect(envelope.users[0].questions[0].additionalComment).toBe(
        visibility === 'public' ? publicComment : undefined,
      );
      render(
        <ComparePresentation
          users={users}
          labels={['Participant']}
          result={{ agreements: [], disagreements: [] }}
          compass={null}
          axesSource="fallback"
          generation={null}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /Explore answers/ }));
      expect(screen.getByText(question.prompt)).toBeVisible();
      if (visibility === 'public') expect(screen.getByText(publicComment, { exact: false })).toBeVisible();
      else {
        expect(screen.queryByText(privateComment, { exact: false })).not.toBeInTheDocument();
        expect(screen.queryByText('*')).not.toBeInTheDocument();
      }
    },
  );
});
