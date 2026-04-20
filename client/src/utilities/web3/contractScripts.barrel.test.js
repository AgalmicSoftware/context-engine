import contractScripts, {
  getReadProviderForGroup,
  getSessionConfigBySlug,
} from './contractScripts.js';
import * as contractScriptsModule from './contractScripts.js';
import contractScriptsImpl, {
  getReadProviderForGroup as getReadProviderForGroupImpl,
  getSessionConfigBySlug as getSessionConfigBySlugImpl,
} from './contractScripts.impl.js';

describe('contractScripts compatibility barrel', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the legacy js entrypoint spyable for Jest callers', () => {
    const mocked = { slug: 'mock-session' };
    const spy = jest
      .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
      .mockReturnValue(mocked);

    expect(contractScriptsModule.getSessionConfigBySlug('ignored')).toBe(mocked);
    expect(spy).toHaveBeenCalledWith('ignored');
  });

  it('re-exports the implementation default and named helpers unchanged', () => {
    expect(contractScripts).toBe(contractScriptsImpl);
    expect(getSessionConfigBySlug).toBe(getSessionConfigBySlugImpl);
    expect(getReadProviderForGroup).toBe(getReadProviderForGroupImpl);

    expect(typeof contractScripts.getLatestBlockNumber).toBe('function');
    expect(typeof contractScripts.listenForSurveyEvents).toBe('function');
    expect(typeof contractScripts.getUserActivity).toBe('function');
  });
});
