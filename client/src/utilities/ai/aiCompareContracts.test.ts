import {
  compareSummaryFromParagraphs,
  readCompareSummary,
  readCompareToolkitTask,
  resolveCompareToolkitPayload,
} from './aiCompareContracts';

const letters = ['A', 'B', 'C'];

describe('aiCompareContracts', () => {
  it('reads the titled reply with its headline and sides', () => {
    expect(
      readCompareSummary(
        {
          headline: 'They want a public say;\n they split on who sets the rules.',
          agreements: [{ title: 'Public hearings', text: 'Each would hold a hearing first.' }],
          disagreements: [
            {
              title: 'Who decides',
              text: 'A and C favour councils; B a national body.',
              sides: [
                { who: ['c', 'A'], view: 'say local councils' },
                { who: ['B'], view: 'says a national body' },
              ],
            },
          ],
        },
        letters,
      ),
    ).toEqual({
      headline: 'They want a public say; they split on who sets the rules.',
      agreements: [{ title: 'Public hearings', text: 'Each would hold a hearing first.' }],
      disagreements: [
        {
          title: 'Who decides',
          text: 'A and C favour councils; B a national body.',
          sides: [
            { who: ['A', 'C'], view: 'say local councils' },
            { who: ['B'], view: 'says a national body' },
          ],
        },
      ],
    });
  });

  it('still reads plain paragraphs, with no headline, and keeps at most three per side', () => {
    expect(
      readCompareSummary({ agreements: ['One', 'Two', 'Three', 'Four'], disagreements: ['Apart'] }, letters),
    ).toEqual({
      agreements: [{ text: 'One' }, { text: 'Two' }, { text: 'Three' }],
      disagreements: [{ text: 'Apart' }],
    });
  });

  it('caps the headline at one line of 220 characters', () => {
    const summary = readCompareSummary(
      { headline: `${'word '.repeat(80)}\nend`, agreements: [], disagreements: [] },
      letters,
    );
    expect(summary?.headline).toHaveLength(220);
    expect(summary?.headline).toMatch(/…$/);
    expect(summary?.headline).not.toMatch(/\n/);
    expect(readCompareSummary({ headline: '  ', agreements: [], disagreements: [] }, letters)).not.toHaveProperty(
      'headline',
    );
  });

  it('drops a side naming someone not compared, and the sides when fewer than two remain', () => {
    const summary = readCompareSummary(
      {
        agreements: [],
        disagreements: [
          {
            title: 'Speed',
            text: 'B would pilot now; A would wait.',
            sides: [
              { who: ['B'], view: 'would pilot now' },
              { who: ['A', 'D'], view: 'would wait' },
            ],
          },
          {
            text: 'A is placed twice.',
            sides: [
              { who: ['A'], view: 'yes' },
              { who: ['A', 'B'], view: 'no' },
              { who: ['C'], view: 'unsure' },
            ],
          },
        ],
      },
      letters,
    );
    expect(summary?.disagreements[0]).toEqual({ title: 'Speed', text: 'B would pilot now; A would wait.' });
    expect(summary?.disagreements[1].sides).toEqual([
      { who: ['A'], view: 'yes' },
      { who: ['C'], view: 'unsure' },
    ]);
  });

  it('refuses a reply with an item it cannot read', () => {
    expect(readCompareSummary({ agreements: [{ title: 'No text' }], disagreements: [] }, letters)).toBeNull();
    expect(readCompareSummary({ agreements: [3], disagreements: [] }, letters)).toBeNull();
    expect(readCompareSummary({ agreements: [] }, letters)).toBeNull();
    expect(readCompareSummary(null, letters)).toBeNull();
  });

  it('leaves a blank item out instead of failing a reply that was paid for', () => {
    expect(readCompareSummary({ agreements: ['Shared groups', ' '], disagreements: [''] }, ['A', 'B'])).toEqual({
      agreements: [{ text: 'Shared groups' }],
      disagreements: [],
    });
    // Anything else that cannot be read still fails it.
    expect(readCompareSummary({ agreements: ['Shared groups', 7], disagreements: [] }, ['A', 'B'])).toBeNull();
  });

  it('turns local paragraphs into untitled points', () => {
    expect(compareSummaryFromParagraphs({ agreements: ['Shared groups'], disagreements: [] })).toEqual({
      agreements: [{ text: 'Shared groups' }],
      disagreements: [],
    });
  });

  it('normalizes compare toolkit tasks and bounds payload users', () => {
    expect(readCompareToolkitTask('AXES')).toBe('axes');
    expect(readCompareToolkitTask(null)).toBe('');
    expect(
      resolveCompareToolkitPayload({
        users: Array.from({ length: 12 }, (_, index) => ({ address: `0x${index}` })),
      }),
    ).toEqual({
      users: Array.from({ length: 10 }, (_, index) => ({ address: `0x${index}` })),
    });
    expect(resolveCompareToolkitPayload({ users: 'not-users' })).toEqual({ users: [] });
  });
});
