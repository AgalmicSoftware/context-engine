import { WORKER_CANONICAL_SET_CONFIG_KEYS, classifySessionConfigEdits } from '@ce-shared/sessionConfigEdits.mjs';

describe('shared session config edits in the client', () => {
  it('previews which edits sign participants out and which keys a save may send', () => {
    const before = { sessionName: 'Salon', defaultTags: 'housing' };
    expect(
      classifySessionConfigEdits(before, { ...before, sessionName: 'Salon, part 2', defaultTags: 'housing, transit' }),
    ).toEqual({ content: ['sessionName'], authority: ['defaultTags'], signsParticipantsOut: true });
    expect(WORKER_CANONICAL_SET_CONFIG_KEYS).toContain('sessionModeProfile');
    // Highlighted and hidden question lists are curation: saving them signs no one out.
    expect(WORKER_CANONICAL_SET_CONFIG_KEYS).toContain('HIGHLIGHTED_QUESTION_IDS');
    expect(classifySessionConfigEdits(before, { ...before, BLOCKED_QUESTION_IDS: ['q1'] })).toEqual({
      content: ['BLOCKED_QUESTION_IDS'],
      authority: [],
      signsParticipantsOut: false,
    });
  });
});
