import path from 'path';
import * as sass from 'sass';

describe('DocumentLibraryPanel module styles', () => {
  const css = sass.compile(path.join(__dirname, 'DocumentLibraryPanel.module.scss')).css;

  it('gives the link fields panel text that outranks the theme recipe', () => {
    const recipes = sass.compile(path.join(__dirname, '../../scss/themes/_recipes.scss')).css;
    const recipeSelector = ':root[data-ce-theme] .form-control';
    const fieldSelector = '.uploadBox .uploadRow input.urlField';
    expect(recipes).toContain(recipeSelector);
    expect(css).toMatch(/\.uploadBox \.uploadRow input\.urlField\s*\{\s*color: var\(--ce-panel-text\);/);
    // Classes, attributes and pseudo-classes, then elements: the recipe sets every field's colour.
    const specificity = (selector: string) => [
      (selector.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) || []).length,
      (selector.match(/(?:^|[\s>+~])[a-z][\w-]*/g) || []).length,
    ];
    const [field, recipe] = [specificity(fieldSelector), specificity(recipeSelector)];
    expect(field[0] > recipe[0] || (field[0] === recipe[0] && field[1] > recipe[1])).toBe(true);
  });

  it('gives the file field a whole line on phones so it has room for the file name', () => {
    const phone = css.match(/@media \(max-width: 640px\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
    expect(phone).toMatch(/\.uploadRow\s*\{\s*grid-template-columns: minmax\(0, 1fr\) auto;/);
    expect(phone).toMatch(/\.uploadLabel,\s*\.fileInput\s*\{\s*grid-column: 1\s*\/\s*-1;/);
  });
});
