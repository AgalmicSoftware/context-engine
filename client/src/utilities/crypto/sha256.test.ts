import { sha256Utf8 } from './sha256';

describe('sha256Utf8', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['context-engine', 'd2a3cc91a3825062935ff47b37bd26aeee10c5da82e7b2e461e78b4c1f99bd35'],
    [
      'context-engine:test:v1:{"a":1,"b":["é","🙂"]}',
      'b0956280119937aac04768d4fd4ffa32ef8836b0a324d505bd5b5e703dfed05e',
    ],
  ])('matches the established CryptoJS digest for %j', (value, expected) => {
    expect(sha256Utf8(value)).toBe(expected);
  });
});
