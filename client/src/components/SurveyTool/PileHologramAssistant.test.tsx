import PileHologramAssistant, { resolvePileHologramMeshLineStyle } from './PileHologramAssistant';

const nodeHasClassName = (node: any, className: string): boolean => {
  const value = node?.props?.className;
  if (typeof value !== 'string') return false;
  return value.split(/\s+/).includes(className);
};

const countElements = (node: any, predicate: (candidate: any) => boolean): number => {
  let count = 0;
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) {
        stack.push(current[i]);
      }
      continue;
    }
    if (typeof current !== 'object') continue;
    if (predicate(current)) count += 1;
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return count;
};

const findNodeByClassName = (node: any, className: string): any => {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findNodeByClassName(child, className);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  if (nodeHasClassName(node, className)) return node;
  return findNodeByClassName(node?.props?.children, className);
};

describe('PileHologramAssistant', () => {
  it('renders a denser hologram mesh with dedicated depth layers', () => {
    const tree = PileHologramAssistant();
    const meshLineCount = countElements(tree, (node) => nodeHasClassName(node, 'pileHologramMeshLine'));
    const contourCount = countElements(tree, (node) => nodeHasClassName(node, 'pileHologramContourLine'));

    expect(meshLineCount).toBeGreaterThanOrEqual(30);
    expect(contourCount).toBeGreaterThanOrEqual(5);
    expect(findNodeByClassName(tree, 'pileHologramDepthShell')).not.toBeNull();
    expect(findNodeByClassName(tree, 'pileHologramDepthOutline')).not.toBeNull();
    expect(findNodeByClassName(tree, 'pileHologramFaceCore')).not.toBeNull();
  });

  it('resolves mesh line opacity styles', () => {
    expect(resolvePileHologramMeshLineStyle(0.42)).toEqual({ opacity: 0.42 });
    expect(resolvePileHologramMeshLineStyle(undefined)).toEqual({ opacity: 0 });
  });
});
