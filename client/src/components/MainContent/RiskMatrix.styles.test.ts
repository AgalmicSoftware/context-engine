import fs from 'fs';
import path from 'path';

const scss = fs.readFileSync(path.join(__dirname, 'RiskMatrix.module.scss'), 'utf8');

// Each `@media … { … }` block, braces and all.
const mediaBlocks = () => {
  const blocks: string[] = [];
  let at = scss.indexOf('@media ');
  while (at >= 0) {
    let depth = 0;
    let end = scss.indexOf('{', at);
    for (; end < scss.length; end += 1) {
      if (scss[end] === '{') depth += 1;
      if (scss[end] === '}') depth -= 1;
      if (depth === 0) break;
    }
    blocks.push(scss.slice(at, end + 1));
    at = scss.indexOf('@media ', end);
  }
  return blocks;
};

describe('Risk matrix pinned labels', () => {
  const blocks = mediaBlocks();
  const phone = blocks.filter((block) => block.startsWith('@media (max-width: 768px) {')).join('\n');
  // The rules that hold at every width: the stylesheet without its media blocks.
  const everyWidth = blocks.reduce((text, block) => text.replace(block, ''), scss);

  it('keeps the row labels at the left at every width, so a grid wider than its card reads as it scrolls', () => {
    expect(phone).not.toBe('');
    expect(everyWidth).toMatch(/\.axisTop,\s*\.axisLeft\s*{\s*position:\s*sticky;/);
    expect(everyWidth).toMatch(/\.axisLeft\s*{\s*left:\s*0;\s*}/);
    expect(everyWidth).toMatch(/\.pinnedScroll\s*{[^}]*scroll-padding:\s*84px 0 0 130px;/);
    expect(blocks.join('\n')).not.toMatch(/sticky/);
  });

  it('draws the ring of a focused square inside it, where the rim of a label beside it cannot cover it', () => {
    expect(everyWidth).toMatch(/\.gridCell:focus-visible\s*{\s*outline-offset:\s*-3px !important;\s*}/);
  });

  it('keeps the face of the corner under the pointer, since the corner is no control', () => {
    expect(everyWidth).toMatch(/\.cornerCell,\s*\.cornerCell:hover\s*{\s*@include pinned-face\(/);
  });

  it('scrolls the grid down inside its card only on a phone, where the column labels stay at the top', () => {
    expect(phone).toMatch(/\.pinnedScroll\s*{[^}]*max-height:\s*70svh;\s*overflow:\s*auto;/);
    expect(everyWidth).not.toMatch(/70svh/);
  });
});
