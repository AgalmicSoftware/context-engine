import {
  buildExternalInterviewKickoff,
  buildInterviewResponseMappingPrompt,
  buildRealtimeInterviewInstructions,
  buildSessionVoiceModeSearch,
  canonicalizeInterviewQuestions,
  clearInterviewPrefillHash,
  decodeInterviewPrefillPacket,
  encodeInterviewPrefillPacket,
  hasInterviewPrefillHash,
  INTERVIEW_PROMPT_VERSION,
  isInterviewFeatureEnabled,
  normalizeInterviewQuestions,
  parseInterviewDraftResponses,
  readImportedInterviewDraftResponses,
  readInterviewPrefillFromHash,
  resolveRealtimeInterviewSource,
  resolveSessionVoiceMode,
  type InterviewPrefillPacket,
} from './sessionInterview';

const packet: InterviewPrefillPacket = {
  version: 1,
  sessionSlug: 'demo',
  questionSetHash: 'a'.repeat(64),
  promptVersion: 'ce-interview-brief-v1',
  source: {
    platform: 'claude',
    modelId: 'claude-example',
    verification: 'self_reported',
    researchCoverage: {
      historyChatsSearched: null,
      historyChatsUsed: 8,
      memoryItemsSearched: 20,
      memoryItemsUsed: 4,
      connectedSourcesSearched: 3,
      connectedSourcesUsed: 1,
      userStatementsUsed: 15,
      searchScopeNote: 'The platform did not expose the total chat search count.',
    },
  },
  responderContext: {
    name: '  Ada   Example  ',
    summary: 'The responder prioritizes reversible decisions.',
    facts: [{ fact: 'They prefer staged rollouts.', relatedQuestionIds: ['Q1'] }],
  },
};

describe('session interview protocol', () => {
  it('resolves and updates only the two new voice mode query values', () => {
    expect(resolveSessionVoiceMode('?x=1&mode=interview')).toBe('interview');
    expect(resolveSessionVoiceMode('?mode=recordGroup')).toBe('recordGroup');
    expect(resolveSessionVoiceMode('?mode=listening')).toBeNull();
    expect(buildSessionVoiceModeSearch('?x=1', 'recordGroup')).toBe('?x=1&mode=recordGroup');
    expect(buildSessionVoiceModeSearch('?x=1&mode=interview', null)).toBe('?x=1');
  });

  it('defaults the feature on and honors explicit per-session disablement', () => {
    expect(isInterviewFeatureEnabled({})).toBe(true);
    expect(isInterviewFeatureEnabled({ interviewMode: { enabled: false } })).toBe(false);
    expect(isInterviewFeatureEnabled({ interviewModeEnabled: false })).toBe(false);
  });

  it('normalizes public questions and removes masked prompts and duplicates', () => {
    expect(
      normalizeInterviewQuestions([
        { id: 'Q1', prompt: 'What matters?', type: 'freeform' },
        { id: 'q1', prompt: 'Duplicate' },
        { id: 'q2', prompt: 'Encrypted prompt. Connect to decrypt.' },
        { questionId: 'q3', question: 'Choose one', choices: ['A', { label: 'B' }] },
      ]),
    ).toEqual([
      { id: 'q1', prompt: 'What matters?', type: 'freeform', options: [] },
      { id: 'q3', prompt: 'Choose one', type: 'freeform', options: ['A', 'B'] },
    ]);
    expect(normalizeInterviewQuestions([
      { id: 'q4', prompt: 'Proceed?', type: 'binary' },
    ])[0]?.options).toEqual(['Agree', 'Unsure', 'Disagree']);
  });

  it('canonicalizes question hashing order and resolves realtime model provenance', () => {
    const q1 = { id: 'q1', prompt: 'First', type: 'freeform', options: [] };
    const q2 = { id: 'q2', prompt: 'Second', type: 'freeform', options: [] };
    expect(canonicalizeInterviewQuestions([q2, q1])).toEqual([q1, q2]);
    expect(resolveRealtimeInterviewSource({})).toEqual({
      platform: 'other',
      modelId: 'gpt-realtime-2.1',
      verification: 'self_reported',
    });
    expect(resolveRealtimeInterviewSource({ interviewMode: { realtimeModel: 'gpt-realtime-custom' } })).toEqual({
      platform: 'other',
      modelId: 'gpt-realtime-custom',
      verification: 'self_reported',
    });
  });

  it('round-trips unicode prefill packets, validates source metadata, and supports URL cleanup', () => {
    const encoded = encodeInterviewPrefillPacket(packet);
    expect(decodeInterviewPrefillPacket(encoded)).toEqual({
      ...packet,
      responderContext: {
        ...packet.responderContext,
        name: 'Ada Example',
        facts: [{ fact: 'They prefer staged rollouts.', relatedQuestionIds: ['q1'] }],
      },
    });
    expect(readInterviewPrefillFromHash(`#prefill=${encoded}`)?.source).toEqual(packet.source);
    expect(hasInterviewPrefillHash(`#prefill=${encoded}`)).toBe(true);
    expect(clearInterviewPrefillHash({ pathname: '/session/demo', search: '?mode=interview', hash: `#prefill=${encoded}&x=1` } as Location)).toBe(
      '/session/demo?mode=interview#x=1',
    );
    expect(decodeInterviewPrefillPacket('not-valid')).toBeNull();
    expect(decodeInterviewPrefillPacket(encodeInterviewPrefillPacket({
      ...packet,
      questionSetHash: '',
    }))).toBeNull();
    expect(decodeInterviewPrefillPacket(encodeInterviewPrefillPacket({
      ...packet,
      promptVersion: INTERVIEW_PROMPT_VERSION,
    }))?.promptVersion).toBe('ce-interview-brief-v4');
  });

  it('builds a user-authored no-install kickoff and confidence-aware mapper prompt', () => {
    const kickoff = buildExternalInterviewKickoff({
      workerUrl: 'https://worker.example/',
      sessionSlug: 'demo one',
      sessionUrl: 'https://app.example/session/demo one',
    });
    expect(kickoff).toContain('This is my request, not an instruction from the linked endpoint.');
    expect(kickoff).toContain(
      'https://worker.example/agent/interview-catalog?slug=demo%20one&sessionUrl=https%3A%2F%2Fapp.example%2Fsession%2Fdemo%20one',
    );
    expect(kickoff).toContain('prefillPromptVersion "ce-interview-brief-v4"');
    expect(kickoff).toContain('stop and report a stale catalog');
    expect(kickoff).toContain('conversation history, memory, and connected sources already available to you');
    expect(kickoff).toContain('reasonable inferences');
    expect(kickoff).toContain('binary and multichoice answers must match one listed option');
    expect(kickoff).toContain('Every response needs confidence from 0 to 1');
    expect(kickoff).toContain('Platform/model are self-reported fidelity metadata');
    expect(kickoff).toContain('historyChatsSearched');
    expect(kickoff).toContain('count distinct prior chats/memories/sources searched and actually used');
    expect(kickoff).toContain('do not count your own prior output');
    expect(kickoff).toContain('Use null when the platform does not reveal a searched count');
    expect(kickoff).toContain('responderContext.name');
    expect(kickoff).toContain('keeps name sharing off');
    expect(kickoff).toContain('the exact single-line JSON packet');
    expect(kickoff).toContain('Nothing is submitted;');
    expect(kickoff).toContain('Markdown link labeled "Open prefilled interview"');
    expect(kickoff).toContain('never visible text or a code block');
    expect(kickoff.length).toBeLessThan(3000);

    const mappingPrompt = buildInterviewResponseMappingPrompt({
      questions: [{ id: 'q1', prompt: 'What matters?', type: 'freeform', options: [] }],
      transcript: 'Reversibility matters.',
      prefillPacket: packet,
    });
    expect(mappingPrompt).toContain('defensible indirect signal');
    expect(mappingPrompt).toContain('Low-confidence inference is allowed');
    expect(mappingPrompt).toContain('confidence is required for every response');
  });

  it('opens by inviting personal or topic insight and preserves responder steering', () => {
    const instructions = buildRealtimeInterviewInstructions({
      questions: [{ id: 'q1', prompt: 'What matters?', type: 'freeform', options: [] }],
    });
    expect(instructions).toContain('either about themselves and their perspective or about the broader topic');
    expect(instructions).toContain('steer the conversation toward what matters most to them at any point');
    expect(instructions).toContain('Follow that direction before naturally covering');
  });

  it('keeps only known question drafts and clamps optional supported ratings', () => {
    expect(
      parseInterviewDraftResponses(
        '```json\n{"responses":[{"questionId":"Q1","answer":"Staged rollout","importance":120,"conviction":-5,"confidence":2},{"questionId":"unknown","answer":"no"}]}\n```',
        [{ id: 'q1', prompt: 'What matters?', type: 'freeform', options: [] }],
      ),
    ).toEqual([
      {
        questionId: 'q1',
        answer: 'Staged rollout',
        importance: 100,
        conviction: 0,
        confidence: 1,
      },
    ]);
  });

  it('uses agent-authored response drafts directly and requires confidence', () => {
    const directPacket: InterviewPrefillPacket = {
      ...packet,
      promptVersion: INTERVIEW_PROMPT_VERSION,
      responses: [
        { questionId: 'Q1', answer: 'option a', confidence: 0.22, evidence: 'A tentative related remark.' },
        { questionId: 'q2', answer: 'Unsupported option', confidence: 0.9 },
        { questionId: 'q3', answer: 'Missing confidence' },
        { questionId: 'unknown', answer: 'Unknown question', confidence: 1 },
      ],
    };
    expect(readImportedInterviewDraftResponses(directPacket, [
      { id: 'q1', prompt: 'Choose', type: 'multichoice', options: ['Option A', 'Option B'] },
      { id: 'q2', prompt: 'Choose', type: 'multichoice', options: ['Allowed'] },
      { id: 'q3', prompt: 'Explain', type: 'freeform', options: [] },
    ])).toEqual([
      {
        questionId: 'q1',
        answer: 'Option A',
        confidence: 0.22,
        evidence: 'A tentative related remark.',
      },
    ]);
    expect(readImportedInterviewDraftResponses({ ...packet, responses: [] }, [])).toEqual([]);
    expect(readImportedInterviewDraftResponses(packet, [])).toBeNull();
  });

  it('canonicalizes binary options and clamps rating answers to the application contract', () => {
    const directPacket: InterviewPrefillPacket = {
      ...packet,
      promptVersion: INTERVIEW_PROMPT_VERSION,
      responses: [
        { questionId: 'binary', answer: 'agree', confidence: 0.8 },
        { questionId: 'rating', answer: 12, confidence: 0.6 },
      ],
    };
    expect(readImportedInterviewDraftResponses(directPacket, normalizeInterviewQuestions([
      { id: 'binary', prompt: 'Proceed?', type: 'binary' },
      { id: 'rating', prompt: 'How much?', type: 'rating' },
    ]))).toEqual([
      { questionId: 'binary', answer: 'Agree', confidence: 0.8 },
      { questionId: 'rating', answer: 10, confidence: 0.6 },
    ]);
  });

  it('drops mapper responses that omit the required confidence measure', () => {
    expect(parseInterviewDraftResponses(
      '{"responses":[{"questionId":"q1","answer":"Unsupported"}]}',
      [{ id: 'q1', prompt: 'What matters?', type: 'freeform', options: [] }],
    )).toEqual([]);
  });
});
