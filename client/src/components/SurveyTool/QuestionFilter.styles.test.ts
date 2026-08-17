import fs from 'fs';
import path from 'path';

const readQuestionFilterScss = () => fs.readFileSync(path.join(__dirname, 'QuestionFilter.module.scss'), 'utf8');

describe('QuestionFilter styles', () => {
  it('uses a high-contrast Classic 95 dialog and readable tag controls', () => {
    const scss = readQuestionFilterScss();

    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?\.modalHeader\s*{[\s\S]*?background:\s*var\(--ce-titlebar-bg\) !important;[\s\S]*?:global\(\.modal-title\)\s*{[\s\S]*?color:\s*var\(--ce-titlebar-text\) !important;/,
    );
    expect(scss).toMatch(
      /\.tagBubble\s*{[\s\S]*?background:\s*var\(--ce-control-face\);[\s\S]*?color:\s*var\(--ce-control-text\);[\s\S]*?transition:\s*none;[\s\S]*?&:focus,\s*&:focus-visible\s*{[\s\S]*?outline:\s*2px dotted var\(--ce-focus-ring\);/,
    );
    expect(scss).toMatch(
      /\.tagBubbleSelected,[\s\S]*?\.tagBubble\[aria-pressed='true'\]:hover,[\s\S]*?\.tagBubble\[aria-pressed='true'\]:focus-visible\s*{[\s\S]*?background:\s*var\(--ce-selection-bg\) !important;[\s\S]*?color:\s*var\(--ce-selection-text\) !important;/,
    );
    expect(scss).toMatch(
      /\.modalFooter\s*{[\s\S]*?:global\(\.btn-primary\)\s*{[\s\S]*?background:\s*var\(--ce-action-primary\) !important;[\s\S]*?color:\s*var\(--ce-action-primary-text\) !important;/,
    );
  });
});
