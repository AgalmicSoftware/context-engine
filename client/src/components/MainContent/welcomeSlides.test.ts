import fs from 'fs';
import path from 'path';
import { WELCOME_SLIDES } from './welcomeSlides.js';

describe('welcome slide assets', () => {
  it('uses one light, transparent dot picture per slide', () => {
    const source = fs.readFileSync(path.join(__dirname, 'welcomeSlides.ts'), 'utf8');
    const files = [...source.matchAll(/from '\.\.\/\.\.\/assets\/img\/([^']+)'/g)].map((match) => match[1]);

    expect(files).toEqual([
      'explainer_first.png',
      'welcome_toolkit.png',
      'welcome_goals.png',
      'welcome_built_to_help.png',
      'welcome_because.png',
      'welcome_looking_for.png',
    ]);
    files.slice(1).forEach((file) => {
      const png = fs.readFileSync(path.join(__dirname, '../../assets/img', file));
      // Trimmed to the drawing so it fills its slot; never larger than the 1024 px source.
      expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(600);
      expect(png.readUInt32BE(16)).toBeLessThanOrEqual(1024);
      expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(600);
      expect(png.readUInt32BE(20)).toBeLessThanOrEqual(1024);
      // Colour type 3 is a palette; its tRNS chunk carries the transparency every theme relies on.
      expect(png[25]).toBe(3);
      expect(png.includes(Buffer.from('tRNS'))).toBe(true);
      expect(png.length).toBeLessThan(80 * 1024);
    });
    WELCOME_SLIDES.forEach((slide) => expect(slide.imageAlt).toMatch(/^(A person|Three people) made of dots /));
  });
});
