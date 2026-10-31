import {
  SESSION_MODE_PRESET_IDS,
  classifySessionModeProfileSupport,
  cloneSessionModePreset,
  compileSessionModeProfile,
  type SessionModeProfile,
} from '../../utilities/session/sessionModeProfile';
import type { AnyRecord } from '../shellTypes';
import { buildSessionWizardDefaultTemplate, normalizeSessionWizardDraftShape } from './sessionWizardDraftState';
import { applySessionModeProfileSelectionToDraft } from './sessionWizardModeProfileDraftController';

const WORDS = (
  'people city budget housing transit park school vote plan group voice money trust risk idea street neighbour ' +
  'council market climate energy water health safety library youth elder worker rent tax fund policy question ' +
  'answer meeting salon coalition essay deck research assembly proposal evidence priority tradeoff value cost ' +
  'benefit local regional open fair clear early late shared common private public small large slow fast'
).split(' ');

// Seeded, varied prose, so compression behaves as it does for real text.
export const prose = (seed: number, length: number): string => {
  let state = seed;
  const next = (count: number) => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) % count;
  };
  let text = '';
  while (text.length < length) {
    const words = Array.from({ length: 8 + next(11) }, () => WORDS[next(WORDS.length)]);
    text += `${words[0][0].toUpperCase()}${words.join(' ').slice(1)}. `;
  }
  return text.slice(0, length).trim();
};

const custom = (edit: (profile: SessionModeProfile) => void): SessionModeProfile => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  edit(profile);
  return profile;
};

export const sessionWizardTemplateProfiles = (): Record<string, SessionModeProfile> => ({
  cloudflare: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  decentralized: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
  publicWithAgents: custom((profile) => {
    profile.encryption = { mode: 'none' };
    profile.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };
    profile.results.visibility = 'public_full_if_storage_public';
    profile.results.exposure = { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 3 };
    profile.surfaces.agentHttp = true;
    profile.export.scope = 'all_session';
  }),
  conflicting: custom((profile) => {
    profile.results.visibility = 'public_full_if_storage_public';
  }),
});

// A setup draft as long as the RxC salon's, with deployment fields that must
// never reach a template. A conflicting profile is reached the way the page
// reaches one: by editing a valid profile.
export const realLengthSessionWizardDraft = (
  profile: SessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
): AnyRecord => {
  const reachable = classifySessionModeProfileSupport(profile).status === 'reachable';
  const selected = reachable ? profile : cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  const draft: AnyRecord = applySessionModeProfileSelectionToDraft(
    buildSessionWizardDefaultTemplate(),
    selected,
    compileSessionModeProfile(selected),
  );
  draft.sessionModeProfile = profile;
  Object.assign(draft, {
    draftId: 'rxc-salon-7f3a',
    sessionName: 'RxC Research Assembly salon: what should the coalition build next?',
    sessionInfo: prose(1, 1800),
    sessionHeader: 'https://arweave.net/pXj3V9kq2LmN8rT5wYb1Zc6Hd4Fg7Ks0Qe_Ua-Io2Rt',
    sessionEndsAt: '2026-11-21T02:00:00.000Z',
    appearance: { colorSchemeId: 'ocean' },
    sessionContext: {
      title: 'Read before the salon',
      paragraphs: [prose(2, 1300), prose(3, 1300), prose(4, 1300), prose(5, 1300)],
      links: [
        { label: 'The essay', url: 'https://example.org/essays/what-coalitions-build' },
        { label: 'RxC post', url: 'https://example.org/blog/research-assembly-2026' },
        { label: 'Coalition site', url: 'https://coalition.example.org/' },
        { label: 'Salon deck', url: 'https://example.org/decks/salon-2026.pdf' },
      ],
    },
    contextFiles: [{ name: 'coalition-deck.pdf' }, { name: 'essay-draft.md' }, { name: 'breakout-notes.txt' }],
    questionsGenPrompt: prose(6, 1500),
    defaultTags: 'housing, transit, climate, governance, funding',
    groupCreationPolicy: 'admin_only',
    interviewModeEnabled: true,
    interviewMode: {
      ...draft.interviewMode,
      openingMode: 'owner',
      openingPrompt: prose(7, 1000),
      steeringPrompt: prose(8, 2800),
      hiddenDraftShare: 0.25,
      showFidelityScore: true,
    },
    ai: {
      ...draft.ai,
      models: {
        ...draft.ai.models,
        fast: { provider: 'anthropic', model: 'claude-sonnet-5-5' },
        thinking: { provider: 'anthropic', model: 'claude-opus-5-5' },
      },
    },
    slug: 'rxc-ra-salon',
    corsWorkerUrl: 'https://rxc-ra-salon.example.workers.dev',
    sessionId: `0x${'1f'.repeat(16)}`,
  });
  return normalizeSessionWizardDraftShape(draft);
};
