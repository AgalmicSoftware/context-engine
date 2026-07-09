import fs from 'fs';
import path from 'path';
import { FORCE_COLD_LOAD_WELCOME_SLIDES_BOOKMARKLET, WELCOME_SLIDES } from './welcomeSlides.js';

describe('welcome slide assets', () => {
  it('uses a transparent goals image so minimized slides do not show a source rectangle', () => {
    const source = fs.readFileSync(path.join(__dirname, 'welcomeSlides.ts'), 'utf8');
    const transparentGoalsAsset = path.join(__dirname, '../../assets/img/jump_transparent.png');

    expect(WELCOME_SLIDES[2]?.key).toBe('goals');
    expect(source).toContain('jump_transparent.png');
    expect(fs.existsSync(transparentGoalsAsset)).toBe(true);
  });

  it('keeps the cold-load welcome slide test bookmarklet next to the slide definitions', () => {
    expect(FORCE_COLD_LOAD_WELCOME_SLIDES_BOOKMARKLET).toBe(
      "javascript:localStorage.setItem('ce:forceColdLoadWelcomeSlides','true');localStorage.removeItem('ce_onboarding_complete');localStorage.removeItem('firstVisit');location.href='/'",
    );
  });
});
