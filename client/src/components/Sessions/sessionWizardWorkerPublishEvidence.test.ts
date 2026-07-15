import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { buildSessionWizardWorkerRequirementProof } from './sessionWizardWorkerRequirementProof';
import {
  matchesSessionWizardWorkerPublishEvidence,
  resolveSessionWizardWorkerPublishEvidence,
} from './sessionWizardWorkerPublishEvidence';

const workerUrl = 'https://worker.example.test';
const sessionId = '0x123e4567e89b12d3a456426614174000';
const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
const ai = { models: { fast: { provider: 'openai' }, thinking: { provider: 'openai' } } };
const workerSecrets = { openaiKey: 'sk-verified' };
const runtime = {
  workerMode: 'custom',
  workerSecretsEnabled: true,
  sessionId,
  sessionIdHex: sessionId,
  draft: {
    slug: 'verified-session',
    corsWorkerUrl: workerUrl,
    sessionModeProfile,
    ai,
  },
};
const proof = buildSessionWizardWorkerRequirementProof({
  workerUrl,
  sessionSlug: runtime.draft.slug,
  sessionId,
  sessionModeProfile,
  sessionAi: ai,
  workerSecrets,
});

describe('sessionWizardWorkerPublishEvidence', () => {
  it('captures an exact immutable snapshot for unchanged custom deployment evidence', () => {
    const evidence = resolveSessionWizardWorkerPublishEvidence({
      runtime,
      proof,
      workerSecrets,
      deployComplete: true,
      deployWorkerUrl: workerUrl,
    });
    expect(evidence).toEqual(expect.objectContaining({ verified: true, workerUrl }));
    expect(evidence?.draft).not.toBe(runtime.draft);
    expect(evidence?.workerSecrets).not.toBe(workerSecrets);
    expect(evidence?.settlementIdentity).toEqual({
      workerUrl,
      slug: 'verified-session',
      sessionId,
    });
  });

  it('detects draft config edits between the captured snapshot and readback', () => {
    const captured = resolveSessionWizardWorkerPublishEvidence({
      runtime,
      proof,
      workerSecrets,
      deployComplete: true,
      deployWorkerUrl: workerUrl,
    });
    const unchanged = resolveSessionWizardWorkerPublishEvidence({
      runtime,
      proof,
      workerSecrets,
      deployComplete: true,
      deployWorkerUrl: workerUrl,
    });
    const edited = resolveSessionWizardWorkerPublishEvidence({
      runtime: {
        ...runtime,
        draft: { ...runtime.draft, sessionName: 'Edited during readback' },
      },
      proof,
      workerSecrets,
      deployComplete: true,
      deployWorkerUrl: workerUrl,
    });

    expect(matchesSessionWizardWorkerPublishEvidence(captured, unchanged)).toBe(true);
    expect(edited).toEqual(expect.objectContaining({ verified: true }));
    expect(matchesSessionWizardWorkerPublishEvidence(captured, edited)).toBe(false);
  });

  it.each([
    ['secret', { workerSecrets: { openaiKey: 'sk-edited' } }],
    [
      'provider',
      {
        runtime: {
          ...runtime,
          draft: { ...runtime.draft, ai: { models: { fast: { provider: 'anthropic' } } } },
        },
      },
    ],
    [
      'worker URL',
      { runtime: { ...runtime, draft: { ...runtime.draft, corsWorkerUrl: 'https://edited.example.test' } } },
    ],
    [
      'deployment profile',
      {
        runtime: {
          ...runtime,
          draft: {
            ...runtime.draft,
            sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
          },
        },
      },
    ],
  ])('rejects a live %s edit against the deployment proof', (_label, overrides) => {
    expect(
      resolveSessionWizardWorkerPublishEvidence({
        runtime,
        proof,
        workerSecrets,
        deployComplete: true,
        deployWorkerUrl: workerUrl,
        ...overrides,
      }),
    ).toEqual(expect.objectContaining({ verified: false }));
  });

  it('fails closed when custom worker-canonical proof evidence is absent', () => {
    expect(
      resolveSessionWizardWorkerPublishEvidence({
        runtime,
        workerSecrets,
        deployComplete: true,
        deployWorkerUrl: workerUrl,
      }),
    ).toEqual(expect.objectContaining({ verified: false, reason: 'missing-proof' }));
  });

  it('accepts the shared default only when default mode is explicitly selected', () => {
    expect(
      resolveSessionWizardWorkerPublishEvidence({
        runtime: { ...runtime, workerMode: 'default' },
        workerSecrets,
        defaultWorkerUrl: workerUrl,
      }),
    ).toEqual(expect.objectContaining({ verified: true }));
    expect(
      resolveSessionWizardWorkerPublishEvidence({
        runtime: { ...runtime, workerMode: 'custom' },
        workerSecrets,
        deployComplete: false,
        deployWorkerUrl: workerUrl,
        defaultWorkerUrl: workerUrl,
      }),
    ).toEqual(expect.objectContaining({ verified: false }));
  });
});
