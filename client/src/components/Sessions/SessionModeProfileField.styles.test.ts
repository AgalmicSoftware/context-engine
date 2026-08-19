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

  it('keeps the setup-choice title and eyebrow prominent on narrow screens', () => {
    expect(source).toMatch(
      /\.headerProfileSelectionStep\s*\{[\s\S]*?\.headerTitleBlock\s*\{[\s\S]*?h1\s*\{[\s\S]*?font-size:\s*clamp\(28px, 4vw, 32px\);/,
    );
    expect(source).toMatch(
      /\.modeProfileEntryEyebrow\s*\{[\s\S]*?font-size:\s*0\.82rem;[\s\S]*?font-weight:\s*850;/,
    );
    expect(source).toMatch(/\.modeProfileArchitectureLink\s*\{[\s\S]*?font-size:\s*0\.9rem;/);
  });

  it('renders requirements as larger green high-contrast theme pills', () => {
    expect(source).toMatch(/\.modePresetCardRequirementPills\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;/);
    expect(source).toMatch(
      /\.modePresetCardRequirementPill\s*\{[\s\S]*?min-height:\s*34px;[\s\S]*?padding:\s*7px 12px;[\s\S]*?border:\s*1px solid var\(--ce-action-accent\);[\s\S]*?background:\s*color-mix\(in srgb, var\(--ce-action-accent\) 88%, var\(--ce-overlay-base\)\);[\s\S]*?color:\s*var\(--ce-action-accent-text\);[\s\S]*?font-size:\s*0\.84rem;/,
    );
  });

  it('keeps the compact hosting choices in one pill without inner button borders', () => {
    expect(source).toMatch(
      /\.modePresetToggle\s*\{[\s\S]*?padding:\s*3px;[\s\S]*?border:\s*1px solid[\s\S]*?border-radius:\s*var\(--ce-radius-pill\);/,
    );
    expect(source).toMatch(/\.modePresetButton\s*\{[\s\S]*?border:\s*0;/);
    expect(source).not.toMatch(/\.modePresetButtonSelected\s*\{[^}]*border(?:-color)?:/);
  });

  it('renders the saved-draft resume action as a clear primary target', () => {
    expect(source).toMatch(
      /\.modeSavedProfileEntry\s*\{[\s\S]*?:global\(\.btn\)\s*\{[\s\S]*?min-height:\s*48px;[\s\S]*?padding:\s*10px 18px;[\s\S]*?font-size:\s*0\.9rem;[\s\S]*?font-weight:\s*800;/,
    );
  });
});
