import fs from 'fs';
import path from 'path';

describe('Account.module.scss modal account layout guards', () => {
  it('keeps the narrow account modal fix scoped to the modal shell', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Account.module.scss'), 'utf8');

    expect(scss).toMatch(
      /@media \(max-width: 600px\)\s*{[\s\S]*?\.accountModalBody\s*{[\s\S]*?align-items:\s*stretch;[\s\S]*?gap:\s*1rem;[\s\S]*?padding:\s*1rem 0\.75rem;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 600px\)\s*{[\s\S]*?\.accountModalProfileShell\s*{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?overflow-x:\s*hidden;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 600px\)\s*{[\s\S]*?\.accountModalProfileShell > \*\s*{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;/,
    );
    expect(scss).not.toMatch(/:global\([^)]*userPage/i);
    expect(scss).not.toMatch(/:global\([^)]*userInfo/i);
  });

  it('anchors the account modal close button in the card header corner', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Account.module.scss'), 'utf8');

    expect(scss).toMatch(
      /#loginModalCard\s*{[\s\S]*?margin-top:\s*0;[\s\S]*?:global\(\.card-header\)\s*{[\s\S]*?position:\s*relative;[\s\S]*?padding-right:\s*4\.25rem;/,
    );
    expect(scss).toMatch(
      /:global\(\.modal-login \.close\)\s*(?:,[^{]*?)?\s*{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*1rem;[\s\S]*?right:\s*1rem;[\s\S]*?background:\s*transparent;[\s\S]*?color:\s*var\(--ce-titlebar-text\);[\s\S]*?opacity:\s*0\.85;/,
    );
  });

  it('uses matched semantic surfaces for the login title and passkey explanation', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Account.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.Web3SettingsModalTitle\s*{[\s\S]*?color:\s*var\(--ce-titlebar-text\);[\s\S]*?opacity:\s*1;/,
    );
    expect(scss).toMatch(
      /\.accountWarningMessage\s*{[\s\S]*?background:\s*var\(--ce-surface-sunken\);[\s\S]*?border-color:\s*var\(--ce-border-inset\);[\s\S]*?color:\s*var\(--ce-panel-text\);[\s\S]*?box-shadow:\s*var\(--ce-shadow-pressed\);/,
    );
    expect(scss).not.toMatch(
      /\.accountWarningMessage\s*{[\s\S]*?background:\s*var\(--ce-overlay-base\);[\s\S]*?color:\s*var\(--ce-status-info-text\);/,
    );
  });

  it('styles preference controls as switches and keeps the session summary in the config control family', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Account.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.preferenceToggleTrack\s*{[\s\S]*?width:\s*38px;[\s\S]*?height:\s*22px;[\s\S]*?border-radius:\s*var\(--ce-radius-pill\);/,
    );
    expect(scss).toMatch(
      /\.preferenceToggleButton\[aria-pressed='true'\] \.preferenceToggleThumb\s*{[\s\S]*?background:\s*var\(--ce-action-accent\);[\s\S]*?transform:\s*translateX\(16px\);/,
    );
    expect(scss).toMatch(
      /\.settingsSessionRoute\s*{[\s\S]*?min-height:\s*44px;[\s\S]*?border-radius:\s*var\(--ce-radius-10\);[\s\S]*?border-color:\s*var\(--ce-settings-control-border\);[\s\S]*?border-width:\s*var\(--ce-settings-control-border-width\);[\s\S]*?background:\s*var\(--ce-settings-control-bg\);[\s\S]*?opacity:\s*var\(--ce-settings-control-opacity\);/,
    );
    expect(scss).toMatch(
      /\.sendTestnetFundsButton\.settingsConfigToggleButton,[\s\S]*?\.sendTestnetFundsButton\.preferenceToggleButton\s*{[\s\S]*?background:\s*var\(--ce-settings-control-bg\);[\s\S]*?border-color:\s*var\(--ce-settings-control-border\);[\s\S]*?opacity:\s*var\(--ce-settings-control-opacity\);/,
    );
  });

  it('uses theme-owned readable surfaces and text throughout Settings', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Account.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.preLoginSettingsPanel\s*{[\s\S]*?background:\s*var\(--ce-settings-panel-bg\);[\s\S]*?color:\s*var\(--ce-settings-text\);/,
    );
    expect(scss).toMatch(
      /\.aiSettingsPanel\s*{[\s\S]*?background:\s*var\(--ce-settings-panel-bg\);[\s\S]*?color:\s*var\(--ce-settings-text\);/,
    );
    expect(scss).toMatch(
      /\.supportedResourceDetail\s*{[\s\S]*?color:\s*var\(--ce-settings-muted-text\);/,
    );
    expect(scss).toMatch(
      /\.preLoginSettingsInput\s*{[\s\S]*?background:\s*var\(--ce-settings-field-bg\);[\s\S]*?color:\s*var\(--ce-settings-text\);/,
    );
    expect(scss).toMatch(
      /\.settingsSectionCard\s*{[\s\S]*?background:\s*var\(--ce-settings-section-bg\);/,
    );
    expect(scss).toMatch(
      /\.preLoginSettingsActions :global\(\.btn-outline-secondary\)\s*{[\s\S]*?background:\s*var\(--ce-settings-control-bg\);[\s\S]*?color:\s*var\(--ce-settings-control-text\);[\s\S]*?opacity:\s*1;/,
    );
    [
      'preLoginSettingsTitle',
      'preLoginSettingsLabel',
      'supportedResourceDetail',
      'supportedResourceSessionsLabel',
      'aiSettingsHint',
      'sessionPillMeta',
    ].forEach((className) => {
      expect(scss).toMatch(new RegExp(`\\.${className}\\s*\\{[^}]*color:\\s*var\\(--ce-settings-muted-text\\);`));
    });
  });

  it('wraps settings controls into non-overlapping half rows at medium widths', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Account.module.scss'), 'utf8');

    expect(scss).toMatch(
      /@media \(min-width:\s*769px\) and \(max-width:\s*1023px\)\s*{[\s\S]*?\.settingsRow\s*{[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?justify-content:\s*center;/,
    );
    expect(scss).toMatch(
      /@media \(min-width:\s*769px\) and \(max-width:\s*1023px\)[\s\S]*?\.settingsRow > \*\s*{[\s\S]*?flex:\s*1 1 calc\(50% - 6px\);[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/,
    );
    expect(scss).toMatch(
      /@media \(min-width:\s*769px\) and \(max-width:\s*1023px\)[\s\S]*?\.settingsSessionRoute,[\s\S]*?\.settingsConfigToggleButton\s*{[\s\S]*?width:\s*100%;[\s\S]*?justify-content:\s*center;/,
    );
    expect(scss).toMatch(
      /@media \(min-width:\s*769px\) and \(max-width:\s*1023px\)[\s\S]*?\.tooltipsToggleButton\s*{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?width:\s*auto;[\s\S]*?min-width:\s*0;[\s\S]*?justify-content:\s*center;/,
    );
  });
});
