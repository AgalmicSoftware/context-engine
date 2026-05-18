import { SurveySelector } from './SurveySelector';

const syncClassSetState = (subject: any) => {
  subject.setState = jest.fn((next: any, cb?: () => void) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    if (patch && typeof patch === 'object') {
      subject.state = { ...subject.state, ...patch };
    }
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject.setState;
};

describe('SurveySelector routing', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('appends session query when SurveySelector pushes survey URLs', () => {
    const priorUrl = window.location.href;
    const pushStateSpy = jest.spyOn(window.history, 'pushState');
    try {
      window.history.replaceState({}, '', '/surveys');
      const subject = new SurveySelector({
        autoOpenResults: false,
        filterState: {},
        isQuestionCacheReady: true,
        isSurveyCacheReady: true,
        singleQuestionMode: false,
        network: { id: 84532 },
        activeSessionSlug: 'edge',
        preventUrlChange: false,
      });

      subject.updateURL('0xABC');

      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/survey/0xabc?session=edge');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('canonicalizes reserved session aliases when SurveySelector pushes survey URLs', () => {
    const priorUrl = window.location.href;
    const pushStateSpy = jest.spyOn(window.history, 'pushState');
    try {
      window.history.replaceState({}, '', '/surveys');

      const debateSubject = new SurveySelector({
        autoOpenResults: false,
        filterState: {},
        isQuestionCacheReady: true,
        isSurveyCacheReady: true,
        singleQuestionMode: false,
        network: { id: 84532 },
        activeSessionSlug: 'DEBATE',
        preventUrlChange: false,
      });
      debateSubject.updateURL('0xABC');
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/survey/0xabc?session=DEBATE');

      const generalSubject = new SurveySelector({
        autoOpenResults: false,
        filterState: {},
        isQuestionCacheReady: true,
        isSurveyCacheReady: true,
        singleQuestionMode: false,
        network: { id: 84532 },
        activeSessionSlug: 'general',
        preventUrlChange: false,
      });
      generalSubject.updateURL('0xABC');
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/survey/0xabc');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('no-ops SurveySelector closeShowResults when results are already closed', () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/questions/results');
    const pathnameBefore = window.location.pathname;
    const pushStateSpy = jest.spyOn(window.history, 'pushState');
    try {
      const subject = new SurveySelector({
        autoOpenResults: false,
        filterState: {},
        isQuestionCacheReady: true,
        isSurveyCacheReady: true,
        singleQuestionMode: false,
        network: { id: 84532 },
        activeSessionSlug: 'edge',
        questionsCacheNonce: 4,
        preventUrlChange: false,
      });
      subject.fetchSurveys = jest.fn();
      subject.computeFilteredQuestionCount = jest.fn();
      subject.state = {
        ...subject.state,
        showResults: false,
        viewMode: 'questions',
      };
      syncClassSetState(subject);

      subject.closeShowResults();

      expect(subject.state.showResults).toBe(false);
      expect(subject.setState).not.toHaveBeenCalled();
      expect(pushStateSpy).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe(pathnameBefore);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('canonicalizes reserved session aliases in SurveySelector survey results URLs', () => {
    const priorUrl = window.location.href;
    const pushStateSpy = jest.spyOn(window.history, 'pushState');
    try {
      window.history.replaceState({}, '', '/surveys');

      const buildSubject = (activeSessionSlug: string) => {
        const subject = new SurveySelector({
          autoOpenResults: false,
          filterState: {},
          isQuestionCacheReady: true,
          isSurveyCacheReady: true,
          singleQuestionMode: false,
          network: { id: 84532 },
          activeSessionSlug,
          preventUrlChange: false,
        });
        subject.state = {
          ...subject.state,
          showResults: false,
          viewMode: 'survey',
          selectedSurveyIndex: 0,
          surveys: [{ id: '0xABC', title: 'Alias Survey' }],
        };
        syncClassSetState(subject);
        return subject;
      };

      const debateSubject = buildSubject('DEBATE');
      debateSubject.toggleShowResults();
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/survey/0xabc/results?session=DEBATE');
      debateSubject.closeShowResults();
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/survey/0xabc?session=DEBATE');

      const generalSubject = buildSubject('general');
      generalSubject.toggleShowResults();
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/survey/0xabc/results');
      generalSubject.closeShowResults();
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/survey/0xabc');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('uses query-pinned question results URLs instead of session-prefixed hardcoded routes', () => {
    const priorUrl = window.location.href;
    const pushStateSpy = jest.spyOn(window.history, 'pushState');
    try {
      window.history.replaceState({}, '', '/session/rxc');

      const subject = new SurveySelector({
        autoOpenResults: false,
        filterState: {},
        isQuestionCacheReady: true,
        isSurveyCacheReady: true,
        singleQuestionMode: false,
        network: { id: 84532 },
        activeSessionSlug: 'rxc',
        preventUrlChange: false,
      });
      subject.state = {
        ...subject.state,
        showResults: false,
        viewMode: 'questions',
      };
      syncClassSetState(subject);

      subject.toggleShowResults();
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/questions/results?session=rxc');

      subject.closeShowResults();
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/questions?session=rxc');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('auto-opens SurveySelector results when ?results=true is present', () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/surveys?results=true');
    try {
      const subject = new SurveySelector({
        autoOpenResults: false,
        filterState: {},
        isQuestionCacheReady: true,
        isSurveyCacheReady: true,
        singleQuestionMode: false,
        network: { id: 84532 },
        activeSessionSlug: 'edge',
        questionsCacheNonce: 4,
      });
      subject.fetchSurveys = jest.fn();
      subject.computeFilteredQuestionCount = jest.fn();
      subject.state = {
        ...subject.state,
        showResults: false,
      };
      syncClassSetState(subject);

      subject.componentDidMount();

      expect(subject.state.showResults).toBe(true);
      expect(subject.setState).toHaveBeenCalledTimes(1);
      expect(subject.setState).toHaveBeenCalledWith(expect.objectContaining({ showResults: true }));
      subject.componentWillUnmount();
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });
});
