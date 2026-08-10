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
      /#loginModalCard\s*{[\s\S]*?:global\(\.card-header\)\s*{[\s\S]*?position:\s*relative;[\s\S]*?padding-right:\s*4\.25rem;/,
    );
    expect(scss).toMatch(
      /:global\(\.modal-login \.close\)\s*(?:,[^{]*?)?\s*{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*1rem;[\s\S]*?right:\s*1rem;[\s\S]*?background:\s*transparent;[\s\S]*?opacity:\s*0\.5;/,
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
      /\.settingsSessionRoute\s*{[\s\S]*?min-height:\s*44px;[\s\S]*?border-radius:\s*var\(--ce-radius-10\);[\s\S]*?border:\s*1px solid color-mix\(in srgb, var\(--ce-text-inverse\) 36%, transparent\);[\s\S]*?background:\s*transparent;/,
    );
    expect(scss).toMatch(
      /\.sendTestnetFundsButton\.settingsConfigToggleButton,[\s\S]*?\.sendTestnetFundsButton\.preferenceToggleButton\s*{[\s\S]*?border-color:\s*color-mix\(in srgb, var\(--ce-text-inverse\) 36%, transparent\);/,
    );
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
