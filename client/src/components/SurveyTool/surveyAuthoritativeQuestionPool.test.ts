import {
  appendMissingAuthoritativePoolQuestions,
  filterQuestionsByAuthoritativePool,
  resolveAuthoritativeQuestionPoolScope,
} from './surveyAuthoritativeQuestionPool';

describe('surveyAuthoritativeQuestionPool', () => {
  it('requires an explicitly session-bound pool before constraining cache rows', () => {
    expect(resolveAuthoritativeQuestionPoolScope([{ id: 'q1', sessionSlug: 'demo' }], 'demo')).toBeNull();
    expect(
      resolveAuthoritativeQuestionPoolScope([{ id: 'q1', sessionSlug: 'edge', sessionSlugExplicit: true }], 'demo'),
    ).toBeNull();

    const scope = resolveAuthoritativeQuestionPoolScope(
      [
        { id: 'q1', sessionSlug: 'demo', sessionSlugExplicit: true },
        { id: 'q2', sessionSlug: 'demo', sessionSlugExplicit: true },
      ],
      'demo',
    );

    expect(scope?.ids.has('q1')).toBe(true);
    expect(scope?.ids.has('q2')).toBe(true);
  });

  it('keeps canonical ids and explicitly matching session rows while dropping unbound cache pollution', () => {
    const scope = resolveAuthoritativeQuestionPoolScope(
      [
        { id: 'q1', prompt: 'Canonical one', sessionSlug: 'demo', sessionSlugExplicit: true },
        { id: 'q2', prompt: 'Canonical two', sessionSlug: 'demo', sessionSlugExplicit: true },
      ],
      'demo',
    );

    const filtered = filterQuestionsByAuthoritativePool(
      [
        { id: 'q1', prompt: 'Cached canonical one' },
        { id: 'q-live', prompt: 'Live explicit demo row', sessionSlug: 'demo', sessionSlugExplicit: true },
        { id: 'q-polluted', prompt: 'Wrong cache row' },
        { id: 'q-edge', prompt: 'Wrong session row', sessionSlug: 'edge', sessionSlugExplicit: true },
      ],
      scope,
    );
    const withMissing = appendMissingAuthoritativePoolQuestions(filtered, scope);

    expect(withMissing.map((question) => question.id)).toEqual(['q1', 'q-live', 'q2']);
  });
});
