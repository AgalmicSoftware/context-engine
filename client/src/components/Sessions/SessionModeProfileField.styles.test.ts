import fs from 'node:fs';
import path from 'node:path';

describe('SessionModeProfileField theme contrast styles', () => {
  const source = fs.readFileSync(path.join(__dirname, 'SessionWizard.module.scss'), 'utf8');

  it('pairs setup-card copy with opaque theme surfaces', () => {
    expect(source).toMatch(
      /\.modePresetCard\s*\{[\s\S]*?background:\s*var\(--ce-card-bg\);[\s\S]*?color:\s*var\(--ce-panel-text\);/,
    );
    expect(source).toMatch(/\.modeProfileEntryEyebrow\s*\{[\s\S]*?color:\s*var\(--ce-text-inverse\);/);
    expect(source).toMatch(/\.modePresetCardProvider\s*\{[\s\S]*?color:\s*var\(--ce-panel-text\);/);
    expect(source).toMatch(/\.modePresetCardDescription\s*\{[\s\S]*?color:\s*var\(--ce-panel-text\);/);
  });

  it('renders requirements as high-contrast theme pills', () => {
    expect(source).toMatch(/\.modePresetCardRequirementPills\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;/);
    expect(source).toMatch(
      /\.modePresetCardRequirementPill\s*\{[\s\S]*?background:\s*var\(--ce-overlay-base\);[\s\S]*?color:\s*var\(--ce-overlay-text\);/,
    );
  });
});
