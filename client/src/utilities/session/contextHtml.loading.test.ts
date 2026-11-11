// The sanitizer loads on first use: cleaning waits for it, and however many
// views ask at once, one purifier with one pair of hooks serves them all.
import type { DOMPurify } from 'dompurify';

type AddHook = (name: string, hook: unknown) => void;
const mockCreated: Array<{ hooks: string[] }> = [];
jest.mock('dompurify', () => {
  const real = jest.requireActual<DOMPurify>('dompurify');
  const factory = (win?: Parameters<DOMPurify>[0]) => {
    const instance = real(win);
    const record = { hooks: [] as string[] };
    mockCreated.push(record);
    const counted = instance as unknown as { addHook: AddHook };
    const addHook = counted.addHook.bind(instance);
    counted.addHook = (name, hook) => {
      record.hooks.push(name);
      addHook(name, hook);
    };
    return instance;
  };
  return { __esModule: true, default: factory };
});

import { cleanContextHtml, loadContextHtmlCleaner } from './contextHtml';

describe('loading the context page cleaner', () => {
  it('refuses to clean before it has loaded', () => {
    expect(() => cleanContextHtml('<p>x</p>')).toThrow('has not loaded yet');
  });

  it('builds one purifier with one pair of hooks, however many ask at once', async () => {
    const cleaners = await Promise.all([loadContextHtmlCleaner(), loadContextHtmlCleaner(), loadContextHtmlCleaner()]);
    await loadContextHtmlCleaner();
    expect(mockCreated).toHaveLength(1);
    expect(mockCreated[0].hooks).toEqual(['uponSanitizeElement', 'uponSanitizeAttribute']);
    cleaners.forEach((clean) => expect(clean).toBe(cleanContextHtml));
    expect(cleanContextHtml('<style>@import "x.css"; p { color: teal; }</style><p>Hi</p>')).toEqual({
      html: '<style> p { color: teal; }</style><p>Hi</p>',
      removed: ['@import'],
    });
  });
});
