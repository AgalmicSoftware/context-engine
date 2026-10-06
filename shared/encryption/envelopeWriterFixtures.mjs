// Non-identifying fixtures shared by the browser and private cc writer tests.
export const envelopeWriterFixtures = [
  { type: 'binary', options: [], values: ['Agree', 'Disagree'] },
  { type: 'rating', options: [], values: [0, 100] },
  {
    type: 'multichoice', options: ['Short', 'é😀'.repeat(90)],
    values: [['Short'], ['é😀'.repeat(90)], ['Short', 'é😀'.repeat(90)]],
  },
  {
    type: 'quadratic', voiceCredits: 99,
    options: Array.from({ length: 65 }, (_, i) => `Option ${i}`),
    values: [Array(65).fill(0), Array(65).fill(-1)],
  },
];
