import SBTFilter from './SBTFilter';

jest.mock('./SBTSelector', () => () => null);

const createSubject = (props = {}, stateOverrides = {}) => {
  const mergedProps = {
    items: [],
    mode: 'addresses',
    provider: 'mock',
    network: { id: 84532 },
    sessionSlug: 'edge',
    isQuestionCacheReady: true,
    isSBTCacheReady: true,
    onFilter: jest.fn(),
    setFilterLoading: jest.fn(),
    ...props,
  };
  const subject = new SBTFilter(mergedProps);
  subject._isMounted = true;
  subject.setState = jest.fn((next, cb) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    subject.state = { ...subject.state, ...(patch || {}) };
    if (typeof cb === 'function') cb();
    return patch;
  });
  subject.state = {
    ...subject.state,
    ...stateOverrides,
  };
  return subject;
};

const findElementsInTree = (node, predicate, acc = []) => {
  if (!node || typeof node !== 'object') return acc;
  if (predicate(node)) acc.push(node);
  const children = node?.props?.children;
  if (Array.isArray(children)) {
    children.forEach((child) => findElementsInTree(child, predicate, acc));
    return acc;
  }
  if (children) {
    findElementsInTree(children, predicate, acc);
  }
  return acc;
};

describe('SBTFilter render guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes defaultFeaturedSBTs through to address-mode SBT selectors', () => {
    const featured = [
      '0x00000000000000000000000000000000000000aa',
      '0x00000000000000000000000000000000000000bb',
    ];
    const subject = createSubject({
      mode: 'addresses',
      autoExpand: true,
      defaultFeaturedSBTs: featured,
    });

    const tree = subject.render();
    const addressSelectors = findElementsInTree(
      tree,
      (element) => ['includeAddresses', 'excludeAddresses'].includes(element?.props?.id)
    );

    expect(addressSelectors).toHaveLength(2);
    addressSelectors.forEach((selectorNode) => {
      expect(selectorNode.props.defaultFeaturedSBTs).toBe(featured);
    });
  });

  it('passes session warm-start props through to address-mode SBT selectors', () => {
    const sessionConfig = { slug: 'edge', networkChainId: 84532 };
    const ensureLightSbtUniverse = jest.fn();
    const subject = createSubject({
      mode: 'addresses',
      autoExpand: true,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      sessionConfig,
      ensureLightSbtUniverse,
    });

    const tree = subject.render();
    const addressSelectors = findElementsInTree(
      tree,
      (element) => ['includeAddresses', 'excludeAddresses'].includes(element?.props?.id)
    );

    expect(addressSelectors).toHaveLength(2);
    addressSelectors.forEach((selectorNode) => {
      expect(selectorNode.props.sessionSlug).toBe('edge');
      expect(selectorNode.props.activeSessionSlug).toBe('edge');
      expect(selectorNode.props.sessionConfig).toBe(sessionConfig);
      expect(selectorNode.props.ensureLightSbtUniverse).toBe(ensureLightSbtUniverse);
    });
  });

  it('can suppress the top-level loading overlay for embedded results filters', () => {
    const withOverlay = createSubject(
      {
        mode: 'responder',
        autoExpand: true,
      },
      {
        loading: true,
        showFilterOptions: true,
      }
    ).render();

    const withoutOverlay = createSubject(
      {
        mode: 'responder',
        autoExpand: true,
        hideLoadingOverlay: true,
      },
      {
        loading: true,
        showFilterOptions: true,
      }
    ).render();

    const spinnerNodesWithOverlay = findElementsInTree(
      withOverlay,
      (element) => element?.props?.icon?.iconName === 'spinner'
    );
    const spinnerNodesWithoutOverlay = findElementsInTree(
      withoutOverlay,
      (element) => element?.props?.icon?.iconName === 'spinner'
    );
    const [filterOptions] = findElementsInTree(
      withoutOverlay,
      (element) =>
        typeof element?.props?.className === 'string' &&
        element.props.className.includes('filterOptions')
    );

    expect(spinnerNodesWithOverlay).toHaveLength(1);
    expect(spinnerNodesWithoutOverlay).toHaveLength(0);
    expect(filterOptions).toBeTruthy();
  });

  it('adds light-surface classes to the collapsed filter button and panel when requested', () => {
    const subject = createSubject(
      {
        mode: 'responder',
        autoExpand: false,
        buttonSurface: 'light',
      },
      {
        showFilterOptions: true,
      }
    );

    const tree = subject.render();
    const [filterButton] = findElementsInTree(
      tree,
      (element) =>
        typeof element?.props?.className === 'string' &&
        element.props.className.includes('filterButton')
    );
    const [filterOptions] = findElementsInTree(
      tree,
      (element) =>
        typeof element?.props?.className === 'string' &&
        element.props.className.includes('filterOptionsOnLight')
    );

    expect(filterButton).toBeTruthy();
    expect(filterButton.props.className).toContain('filterButtonOnLight');
    expect(filterOptions).toBeTruthy();
  });
});
