import fs from 'fs';
import path from 'path';

const readQuestionTagDropdownScss = () =>
  fs.readFileSync(path.join(__dirname, 'QuestionTagDropdown.module.scss'), 'utf8');

describe('QuestionTagDropdown styles', () => {
  it('matches the quiet borderless Classic 95 question utility family', () => {
    const scss = readQuestionTagDropdownScss();

    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?\.toggle\s*{[\s\S]*?border:\s*0 !important;[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;[\s\S]*?color:\s*var\(--ce-control-text\) !important;[\s\S]*?opacity:\s*0\.5 !important;/,
    );
    expect(scss).toMatch(
      /\.toggle:hover,[\s\S]*?\.toggle\[aria-expanded='true'\]\s*{[\s\S]*?opacity:\s*1 !important;/,
    );
  });
});
