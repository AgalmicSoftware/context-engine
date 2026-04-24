import {
  appendExplicitSessionHintToPath,
  applyExistingGroupPrefix,
  hasExplicitSessionQueryPinInPath,
  readPathSearch,
} from './surveyToolNavigation.js';

describe('surveyToolNavigation', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/session/edge/questions');
  });

  it('extracts the query fragment from app-relative paths', () => {
    expect(readPathSearch('/questions?session=edge&foo=bar')).toBe('?session=edge&foo=bar');
    expect(readPathSearch('/questions')).toBe('');
  });

  it('detects explicit session pins in question and survey paths', () => {
    expect(hasExplicitSessionQueryPinInPath('/question/q1?session=edge')).toBe(true);
    expect(hasExplicitSessionQueryPinInPath('/question/q1?sessionId=12')).toBe(true);
    expect(hasExplicitSessionQueryPinInPath('/questions?foo=bar')).toBe(false);
  });

  it('appends a normalized session hint unless the path is already pinned', () => {
    expect(appendExplicitSessionHintToPath('/questions/results', 'Edge')).toBe(
      '/questions/results?session=Edge'
    );
    expect(appendExplicitSessionHintToPath('/questions/results?foo=bar', 'edge')).toBe(
      '/questions/results?foo=bar&session=edge'
    );
    expect(appendExplicitSessionHintToPath('/questions/results?session=other', 'edge')).toBe(
      '/questions/results?session=other'
    );
  });

  it('preserves the existing group prefix for new app-relative paths', () => {
    expect(applyExistingGroupPrefix('/questions/results')).toBe('/session/edge/questions/results');
    expect(applyExistingGroupPrefix('/question/q1?session=other')).toBe('/question/q1?session=other');

    window.history.pushState({}, '', '/questions/results');
    expect(applyExistingGroupPrefix('/questions/results')).toBe('/questions/results');
  });
});
