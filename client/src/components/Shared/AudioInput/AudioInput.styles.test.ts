import fs from 'fs';
import path from 'path';

const readAudioInputScss = () => fs.readFileSync(path.join(__dirname, 'AudioInput.module.scss'), 'utf8');

describe('AudioInput styles', () => {
  it('keeps the microphone control borderless while preserving its keyboard focus indicator', () => {
    const scss = readAudioInputScss();

    expect(scss).toMatch(
      /\.microphoneButton\s*\{[\s\S]*?-webkit-appearance:\s*none;[\s\S]*?appearance:\s*none;[\s\S]*?background:\s*transparent !important;[\s\S]*?border:\s*0 !important;[\s\S]*?box-shadow:\s*none !important;/,
    );
    expect(scss).toMatch(
      /\.microphoneButton\s*\{[\s\S]*?&:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--ce-compat-indigo\);[\s\S]*?outline-offset:\s*2px;/,
    );
  });

  it('keeps the AI rewrite control frameless while preserving its keyboard focus indicator', () => {
    const scss = readAudioInputScss();

    expect(scss).toMatch(
      /\.aiRewriteButton\s*\{[\s\S]*?-webkit-appearance:\s*none;[\s\S]*?appearance:\s*none;[\s\S]*?background:\s*transparent !important;[\s\S]*?border:\s*0 !important;[\s\S]*?box-shadow:\s*none !important;/,
    );
    expect(scss).toMatch(
      /\.aiRewriteButton\s*\{[\s\S]*?&:hover\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?border-color:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;[\s\S]*?&:active\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;/,
    );
    expect(scss).toMatch(
      /\.aiRewriteButton\s*\{[\s\S]*?&:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--ce-focus-ring\);[\s\S]*?outline-offset:\s*2px;/,
    );
  });

  it('keeps additional-comment text and placeholder readable in every app theme', () => {
    const scss = readAudioInputScss();

    expect(scss).toMatch(
      /\.audioTextarea\s*\{[\s\S]*?font-weight:\s*500;[\s\S]*?color:\s*var\(--ce-panel-text, var\(--ce-text\)\) !important;[\s\S]*?caret-color:\s*var\(--ce-panel-text, var\(--ce-text\)\) !important;/,
    );
    expect(scss).toMatch(
      /\.audioTextarea::placeholder\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?color:\s*color-mix\(in srgb, var\(--ce-panel-text, var\(--ce-text\)\) 78%, transparent\) !important;/,
    );
  });
});
