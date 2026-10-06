import { act } from '@testing-library/react';
import { renderSurveyQuestions } from './surveyQuestionsTestHarness';

const verifyAudience = async (audience) => {
  let engine;
  await act(async () => {
    renderSurveyQuestions({
      runtimeStrategy: {
        render: (runtimeEngine) => {
          engine = runtimeEngine;
          return null;
        },
      },
    });
  });
  return engine.verifyEncryption(new Set(['q1']), {
    answers: {
      q1: {
        encrypted: true,
        value: '*',
        encryptionAudience: audience,
        encryptedPortion: JSON.stringify({
          recipients: [
            { type: 'self-eip712-v1' },
            { type: 'worker-response-field-v1', policy: { audience: 'self_admin' } },
          ],
        }),
      },
    },
  });
};

it('explains that an audience change requires decrypting and re-encrypting the response', async () => {
  await expect(verifyAudience('self')).rejects.toThrow(
    'Decrypt and re-encrypt the response for q1 before changing its audience.',
  );
});

it('accepts the audience already bound into the ciphertext', async () => {
  await expect(verifyAudience('self_admin')).resolves.toBe(true);
});
