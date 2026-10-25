// Question id parity fixtures for the browser, MCP and CE-CC consumers: each
// must derive ethers.utils.id(preimage) from generateQuestionId(...args).
export const questionIdFixtures = [
  // Unambiguous inputs keep the legacy text encoding byte for byte.
  { args: ['binary', '  Agents should disclose they are agents. '], preimage: 'binary:agents should disclose they are agents.' },
  { args: ['rating', 'How cooperative: very?'], preimage: 'rating:how cooperative: very?' },
  { args: ['freeform', 'Propose a rule'], preimage: 'freeform:propose a rule' },
  {
    args: ['multichoice', 'Pick one', [' Courts', 'Assembly ', 'Ledger'], true, 99],
    preimage: 'multichoice:pick one:courts,assembly,ledger:single',
  },
  { args: ['multichoice', 'Pick any', ['A', '', '  ', 'B']], preimage: 'multichoice:pick any:a,b' },
  { args: ['multichoice', 'Time: which slot?', ['Morning', 'Evening']], preimage: 'multichoice:time: which slot?:morning,evening' },
  { args: ['multichoice', 'Pick', ['Single'], true], preimage: 'multichoice:pick:single:single' },
  { args: ['multichoice', 'Pick', ['a']], preimage: 'multichoice:pick:a' },
  { args: ['quadratic', 'Fund first', ['Labels', 'Appeals'], false, 50], preimage: 'quadratic:fund first:["labels","appeals"]:50' },
  { args: ['quadratic', 'Fund', ['A,B', 'C:D']], preimage: 'quadratic:fund:["a,b","c:d"]:99' },
  // Multichoice inputs the legacy text could not tell apart hash v2 JSON:
  // options holding a delimiter, no options, or a lone "single" option.
  { args: ['multichoice', 'Pick', ['A,B', 'C']], preimage: '["ce-question-id",2,"multichoice","pick",["a,b","c"],false]' },
  { args: ['multichoice', 'Pick', ['A', 'B,C']], preimage: '["ce-question-id",2,"multichoice","pick",["a","b,c"],false]' },
  { args: ['multichoice', 'Pick', ['single']], preimage: '["ce-question-id",2,"multichoice","pick",["single"],false]' },
  { args: ['multichoice', 'Pick', [], true], preimage: '["ce-question-id",2,"multichoice","pick",[],true]' },
  { args: ['multichoice', 'Pick', ['  ', '']], preimage: '["ce-question-id",2,"multichoice","pick",[],false]' },
  { args: ['multichoice', 'Pick:a', []], preimage: '["ce-question-id",2,"multichoice","pick:a",[],false]' },
  {
    args: ['multichoice', ' Start? ', ['9:00', '10:00'], true],
    preimage: '["ce-question-id",2,"multichoice","start?",["9:00","10:00"],true]',
  },
  // v2 text is NFC-normalized, so composed and decomposed accents agree.
  {
    args: ['multichoice', 'Café?', ['Crème, brûlée', 'Tea']],
    preimage: '["ce-question-id",2,"multichoice","café?",["crème, brûlée","tea"],false]',
  },
  {
    args: ['multichoice', 'Café?', ['Crème, brûlée', 'Tea']],
    preimage: '["ce-question-id",2,"multichoice","café?",["crème, brûlée","tea"],false]',
  },
];
