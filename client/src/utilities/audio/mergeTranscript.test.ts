import { mergeTranscript } from './mergeTranscript';

describe('mergeTranscript', () => {
  it.each([
    ['', '  hello world  ', 'hello world'],
    ['hello world', '', 'hello world'],
    ['hello world', '   ', 'hello world'],
    ['hello world', 'hello world', 'hello world'],
    ['This is a recording', 'a recording continued', 'This is a recording continued'],
    ['The last section.', 'LAST section, continued.', 'The last section. continued.'],
    ['speech yes', 'yes please', 'speech yes yes please'],
    ['first sentence', 'another sentence', 'first sentence another sentence'],
  ])('merges %p and %p without losing speech', (previous, next, expected) => {
    expect(mergeTranscript(previous, next)).toBe(expected);
  });
});
