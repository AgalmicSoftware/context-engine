import fs from 'node:fs';
import path from 'node:path';

describe('SessionModeProfileField theme contrast styles', () => {
  const source = fs.readFileSync(path.join(__dirname, 'SessionWizard.module.scss'), 'utf8');

  const ruleFor = (className: string) => {
    const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return source.match(new RegExp(`\\.${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] || '';
  };

  it('pairs setup-card copy with setup palette tokens and pale blue text', () => {
    expect(source).toMatch(
      /\.modePresetCard\s*\{[\s\S]*?background:\s*var\(--ce-session-setup-surface\);[\s\S]*?color:\s*var\(--ce-session-setup-text\);[\s\S]*?font-family:\s*var\(--ce-font-ui\);/,
    );
    expect(source).toMatch(
      /\.modeProfileEntryPanel \.modePresetCards \.modePresetCard\s*\{[\s\S]*?border-radius:\s*var\(--ce-radius-18\);[\s\S]*?font-family:\s*var\(--ce-font-ui\);/,
    );
    expect(source).toMatch(/\.modePresetCardProvider\s*\{[\s\S]*?color:\s*var\(--ce-session-setup-muted\);/);
    expect(source).toMatch(/\.modePresetCardDescription\s*\{[\s\S]*?color:\s*var\(--ce-session-setup-muted\);/);
  });

  it('keeps the setup-choice title and eyebrow prominent on narrow screens', () => {
    expect(source).toMatch(
      /\.headerProfileSelectionStep\s*\{[\s\S]*?\.headerTitleBlock\s*\{[\s\S]*?h1\s*\{[\s\S]*?font-size:\s*clamp\(28px, 4vw, 32px\);/,
    );
    expect(source).toMatch(/\.modeProfileEntryEyebrow\s*\{[\s\S]*?font-size:\s*0\.82rem;[\s\S]*?font-weight:\s*850;/);
    expect(source).toMatch(/\.modeProfileArchitectureLink\s*\{[\s\S]*?font-size:\s*0\.9rem;/);
  });

  it('keeps each setup provider inline with its larger card title and quiets the requirements heading', () => {
    expect(source).toMatch(
      /\.modePresetCardHeadingText\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*baseline;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?gap:\s*6px 12px;/,
    );
    expect(source).toMatch(
      /\.modePresetCardProvider\s*\{[\s\S]*?margin-top:\s*0;[\s\S]*?font-size:\s*clamp\(1rem, 2\.2vw, 1\.15rem\);[\s\S]*?font-weight:\s*500;[\s\S]*?text-transform:\s*none;/,
    );
    expect(source).toMatch(
      /\.modePresetCardRequirementsLabel\s*\{[\s\S]*?font-size:\s*0\.72rem;[\s\S]*?font-weight:\s*600;/,
    );
  });

  it('renders requirements as compact blue informational theme pills', () => {
    expect(source).toMatch(/\.modePresetCardRequirementPills\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;/);
    expect(source).toMatch(
      /\.modePresetCardRequirementPill\s*\{[\s\S]*?min-height:\s*30px;[\s\S]*?padding:\s*5px 8px;[\s\S]*?border:\s*1px solid color-mix\(in srgb, var\(--ce-session-setup-accent\) 68%, transparent\);[\s\S]*?background:\s*color-mix\(in srgb, var\(--ce-session-setup-accent\) 10%, transparent\);[\s\S]*?color:\s*color-mix\(in srgb, var\(--ce-session-setup-accent\) 78%, var\(--ce-session-setup-text\)\);[\s\S]*?font-size:\s*0\.72rem;/,
    );
    expect(ruleFor('modePresetCardRequirementPill')).not.toContain('var(--ce-action-accent)');
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
      /\.modeSavedProfileEntry\s*\{[\s\S]*?\.modeSavedProfileResumeButton\s*\{[\s\S]*?min-height:\s*48px;[\s\S]*?padding:\s*10px 18px;[\s\S]*?border:\s*1px solid var\(--ce-action-accent\);[\s\S]*?background:\s*var\(--ce-action-accent\);[\s\S]*?color:\s*var\(--ce-action-accent-text\);[\s\S]*?font-size:\s*0\.9rem;[\s\S]*?font-weight:\s*800;/,
    );
    expect(source).toMatch(
      /\.modeSavedProfileEntry\s*\{[\s\S]*?\.modeSavedProfileResumeButton:focus-visible\s*\{[\s\S]*?outline:\s*2px solid color-mix\(in srgb, var\(--ce-action-accent\) 72%, transparent\);[\s\S]*?outline-offset:\s*3px;/,
    );
  });
});
