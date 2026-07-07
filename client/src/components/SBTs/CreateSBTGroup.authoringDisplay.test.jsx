import fs from 'fs';
import path from 'path';

import CreateSBTGroup from './CreateSBTGroup';

const makeInstance = (props = {}) => {
  const instance = new CreateSBTGroup(props);
  instance.setState = (update, cb) => {
    const next = typeof update === 'function' ? update(instance.state) : update;
    instance.state = { ...instance.state, ...next };
    if (cb) cb();
  };
  return instance;
};

describe('CreateSBTGroup authoring display helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses defaultSbtTags as a relevant auto-apply list instead of blindly seeding every default', () => {
    const instance = makeInstance({ defaultSbtTags: 'rxc, debate, governance' });
    instance.loadBookmarks = jest.fn();
    jest.spyOn(instance, 'loadFormCache').mockReturnValue(false);

    instance.componentDidMount();

    expect(instance.state.tags).toEqual([]);

    instance.setState({
      sbtName: 'Debate badge',
      sbtDescription: 'Governance working group',
    });
    instance.syncRelevantDefaultTags();

    expect(instance.state.tags).toEqual(['debate', 'governance']);
    expect(instance.state.autoAppliedDefaultTags).toEqual(['debate', 'governance']);
    expect(instance.state.dismissedDefaultTags).toEqual([]);
  });

  it('keeps removed auto-applied default tags dismissed on future relevance syncs', () => {
    const instance = makeInstance({ defaultSbtTags: 'debate, governance' });
    instance.persistFormCache = jest.fn();
    instance.setState({
      sbtName: 'Debate badge',
      sbtDescription: 'Governance working group',
    });

    instance.syncRelevantDefaultTags();
    expect(instance.state.tags).toEqual(['debate', 'governance']);

    instance.removeTag(0);
    expect(instance.state.tags).toEqual(['governance']);
    expect(instance.state.dismissedDefaultTags).toEqual(['debate']);

    instance.setState({
      sbtDescription: 'Debate and governance working group',
    });
    instance.syncRelevantDefaultTags();

    expect(instance.state.tags).toEqual(['governance']);
    expect(instance.state.dismissedDefaultTags).toEqual(['debate']);
  });

  it('removes auto-applied default tags after the draft stops matching them', () => {
    const instance = makeInstance({ defaultSbtTags: 'debate, governance' });
    instance.setState({
      sbtName: 'Debate badge',
      sbtDescription: 'Governance working group',
    });

    instance.syncRelevantDefaultTags();
    expect(instance.state.tags).toEqual(['debate', 'governance']);
    expect(instance.state.autoAppliedDefaultTags).toEqual(['debate', 'governance']);

    instance.setState({
      sbtName: 'Community badge',
      sbtDescription: 'Local meetup coordination',
    });
    instance.syncRelevantDefaultTags();

    expect(instance.state.tags).toEqual([]);
    expect(instance.state.autoAppliedDefaultTags).toEqual([]);
    expect(instance.state.showTagsInput).toBe(false);
  });

  it('scopes the shared final CTA styling to the primary create button and keeps start-fresh secondary', () => {
    const scssPath = path.join(__dirname, 'CreateSBTGroup.module.scss');
    const jsxPath = path.join(__dirname, 'CreateSBTGroup.tsx');
    const scss = fs.readFileSync(scssPath, 'utf8');
    const jsx = fs.readFileSync(jsxPath, 'utf8');
    const mintingStart = scss.indexOf('.mintingSteps {');
    const progressStart = scss.indexOf('/* --- Progress Indicator', mintingStart);
    const mintingBlock = scss.slice(mintingStart, progressStart);

    expect(jsx).toMatch(/className=\{styles\.primaryCreateButton\}/);
    expect(jsx).toMatch(/className=\{styles\.primaryCreateButtonContent\}/);
    expect(scss).toMatch(
      /\.mintingSteps\s*{[\s\S]*?\.primaryCreateButton\s*{[\s\S]*?@include finalSubmitCta\.final-submit-cta-shell\(/,
    );
    expect(scss).toMatch(
      /\.primaryCreateButtonContent\s*{[\s\S]*?@include finalSubmitCta\.final-submit-cta-content\(\$gap:\s*10px\);[\s\S]*?text-transform:\s*uppercase;/,
    );
    expect(mintingBlock).not.toMatch(/\n\s*button\s*{/);
    expect(scss).not.toMatch(/\.startFreshBtn\s*{[\s\S]*?@include finalSubmitCta\.final-submit-cta-shell\(/);
    expect(scss).toMatch(
      /\.startFreshBtn\s*{[\s\S]*?background:\s*transparent;[\s\S]*?border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.3\);[\s\S]*?box-shadow:\s*none;/,
    );
  });
});
