import { buildDemoCorpusRecords } from './demoCorpusRecords.js';

describe('demoCorpusRecords', () => {
  it('uses entry text as summary when the title is synthesized from summary copy', () => {
    const summary = `
      I am extremely proud to share that this long summary is the only available title source for the entry,
      and it should be truncated before it reaches the card heading because the text keeps going well past the limit.
    `;
    const text = `
      ${summary}

      This longer body should become the card summary so the reader gets more context instead of seeing the
      same sentence repeated twice.
    `;

    const records = buildDemoCorpusRecords([
      {
        key: 'tweets',
        label: 'Tweets',
        entries: [
          {
            id: 'deepseek-huawei',
            author: '@Gregory_C_Allen',
            created_at: '2025-03-07T15:57:45.000Z',
            summary,
            text,
            tags: ['Open Source'],
            url: 'https://example.com/deepseek-huawei',
          },
        ],
      },
    ]);

    expect(records).toHaveLength(1);
    // truncateDemoText(value, maxLength) returns at most (maxLength - 1) trimmed chars + '...' = maxLength + 2 chars total.
    expect(records[0].title.length).toBeLessThanOrEqual(142);
    expect(records[0].title.endsWith('...')).toBe(true);
    expect(records[0].summary.length).toBeLessThanOrEqual(322);
    expect(records[0].summary.endsWith('...')).toBe(true);
    expect(records[0].summary).toContain('longer body');
    expect(records[0].summary).not.toBe(records[0].title);
  });

  it('formats Z-suffixed timestamps in UTC so the calendar day stays stable', () => {
    const records = buildDemoCorpusRecords([
      {
        key: 'tweets',
        label: 'Tweets',
        entries: [
          {
            id: 'shutdown-mechanism',
            author: '@PalisadeAI',
            created_at: '2025-05-24T01:15:36.000Z',
            summary: 'OpenAI o3 sabotaged a shutdown mechanism.',
            tags: ['OpenAI'],
            url: 'https://example.com/shutdown-mechanism',
          },
        ],
      },
    ]);

    expect(records).toHaveLength(1);
    expect(records[0].metaLine).toBe('@PalisadeAI • May 24, 2025');
  });

  it('preserves partial-date shapes without locale timezone drift', () => {
    const records = buildDemoCorpusRecords([
      {
        key: 'research',
        label: 'Research',
        entries: [
          {
            id: 'year-only-entry',
            author: 'Example Author',
            summary: 'Year-only date.',
            tags: ['Open Source'],
            url: 'https://example.com/year-only-entry',
            date: '2023',
          },
          {
            id: 'month-entry-january',
            author: 'Example Author',
            summary: 'Month-only January date.',
            tags: ['Open Source'],
            url: 'https://example.com/month-entry-january',
            date: '2024-01',
          },
          {
            id: 'month-entry-november',
            author: 'Example Author',
            summary: 'Month-only November date.',
            tags: ['Open Source'],
            url: 'https://example.com/month-entry-november',
            date: '2025-11',
          },
        ],
      },
    ]);

    expect(records).toHaveLength(3);
    expect(records[0].metaLine.endsWith(' • 2023')).toBe(true);
    expect(records[1].metaLine.endsWith(' • Jan 2024')).toBe(true);
    expect(records[2].metaLine.endsWith(' • Nov 2025')).toBe(true);
  });
});
