import contractScripts, {
  getReadProviderForGroup,
  getSessionConfigBySlug,
} from './contractScripts.js';
import contractScriptsImpl, {
  getReadProviderForGroup as getReadProviderForGroupImpl,
  getSessionConfigBySlug as getSessionConfigBySlugImpl,
} from './contractScripts.impl.js';

describe('contractScripts compatibility barrel', () => {
  it('re-exports the implementation default and named helpers unchanged', () => {
    expect(contractScripts).toBe(contractScriptsImpl);
    expect(getSessionConfigBySlug).toBe(getSessionConfigBySlugImpl);
    expect(getReadProviderForGroup).toBe(getReadProviderForGroupImpl);

    expect(typeof contractScripts.getLatestBlockNumber).toBe('function');
    expect(typeof contractScripts.listenForSurveyEvents).toBe('function');
    expect(typeof contractScripts.getUserActivity).toBe('function');
  });
});
