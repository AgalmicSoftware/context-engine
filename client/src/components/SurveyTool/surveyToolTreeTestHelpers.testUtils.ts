type TreeProps = {
  children?: unknown;
  className?: unknown;
  label?: unknown;
  [key: string]: unknown;
};

type TreeElement = {
  type?: unknown;
  props?: TreeProps;
};

type TreePredicate = (node: TreeElement) => boolean;

const isTreeElement = (node: unknown): node is TreeElement => !!node && typeof node === 'object';

const readDisplayName = (value: unknown): string => {
  if (!value || typeof value !== 'object') return '';
  const record = value as { displayName?: unknown; name?: unknown; render?: { displayName?: unknown; name?: unknown } };
  return String(record.displayName || record.name || record.render?.displayName || record.render?.name || '');
};

const getNodeTypeName = (node: unknown) => {
  if (!isTreeElement(node)) return '';
  const type = node?.type;
  if (!type) return '';
  if (typeof type === 'string') return type;
  if (typeof type === 'function') return readDisplayName(type);
  if (typeof type === 'object') return readDisplayName(type);
  return '';
};

const RESOLVABLE_SURVEY_TOOL_COMPONENTS = new Set([
  'JsonButtonRow',
  'JsonIconButton',
  'JsonPanel',
  'JsonToggleButton',
  'SurveyQuestionsAuthoringPanel',
  'SurveyQuestionsAuthoringRouteSection',
  'SurveyQuestionsJsonControls',
  'SurveyQuestionsJsonRouteSection',
  'SurveyQuestionsResponseRouteSection',
  'SurveyQuestionsResponseView',
  'SurveyQuestionsRouteBodySection',
  'SurveyQuestionsRouteSurface',
  'SurveyQuestionsSubmitFooter',
  'SurveyQuestionsTagModalSlot',
  'SurveyQuestionsTopRouteSection',
  'SurveyQuestionsTopStrip',
  'SurveyQuestionsUserResponseNotice',
]);

const resolvedComponentCache = new WeakMap<object, unknown>();

const renderResolvableComponent = (node: unknown) => {
  if (!isTreeElement(node)) return null;
  const typeName = getNodeTypeName(node);
  if (!RESOLVABLE_SURVEY_TOOL_COMPONENTS.has(typeName)) return null;
  const type = node?.type;
  if (resolvedComponentCache.has(node)) return resolvedComponentCache.get(node);
  let rendered = null;
  if (typeof type === 'function') {
    rendered = type(node.props || {});
  } else if (type && typeof type === 'object') {
    const render = (type as { render?: unknown }).render;
    if (typeof render === 'function') {
      rendered = render(node.props || {}, null);
    }
  }
  resolvedComponentCache.set(node, rendered);
  return rendered;
};

export const treeHasDataTestId = (node: unknown, testId: unknown): boolean => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasDataTestId(child, testId));
  if (typeof node !== 'object') return false;
  if (!isTreeElement(node)) return false;
  if (node?.props?.['data-testid'] === testId) return true;
  const rendered = renderResolvableComponent(node);
  if (rendered !== null) return treeHasDataTestId(rendered, testId);
  return treeHasDataTestId(node?.props?.children, testId);
};

export const treeHasLabel = (node: unknown, label: unknown): boolean => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasLabel(child, label));
  if (typeof node !== 'object') return false;
  if (!isTreeElement(node)) return false;
  if (node?.props?.label === label) return true;
  const rendered = renderResolvableComponent(node);
  if (rendered !== null) return treeHasLabel(rendered, label);
  return treeHasLabel(node?.props?.children, label);
};

export const treeHasText = (node: unknown, text: string): boolean => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  if (!isTreeElement(node)) return false;
  const rendered = renderResolvableComponent(node);
  if (rendered !== null) return treeHasText(rendered, text);
  return treeHasText(node?.props?.children, text);
};

export const findElement = (node: unknown, predicate: TreePredicate): TreeElement | null => {
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
    if (!isTreeElement(current)) continue;
    if (predicate(current)) return current;
    const rendered = renderResolvableComponent(current);
    if (rendered !== null) {
      stack.push(rendered);
      continue;
    }
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

export const findFirstNodeByType = (node: unknown, targetType: unknown): TreeElement | null => {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirstNodeByType(child, targetType);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  if (!isTreeElement(node)) return null;
  if (node?.type === targetType) return node;
  const rendered = renderResolvableComponent(node);
  if (rendered !== null) return findFirstNodeByType(rendered, targetType);
  return findFirstNodeByType(node?.props?.children, targetType);
};

export const nodeHasClassName = (node: unknown, className: string): boolean => {
  if (!isTreeElement(node)) return false;
  const value = node?.props?.className;
  if (typeof value !== 'string') return false;
  return value.split(/\s+/).includes(className);
};

export const findNodeByClassName = (node: unknown, className: string) =>
  findElement(node, (candidate) => nodeHasClassName(candidate, className));

export const getElementChildren = (node: unknown): TreeElement[] => {
  if (!isTreeElement(node)) return [];
  const children = node?.props?.children;
  if (children == null) return [];
  return (Array.isArray(children) ? children : [children]).filter(isTreeElement);
};

export const countElements = (node: unknown, predicate: TreePredicate): number => {
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
    if (!isTreeElement(current)) continue;
    if (predicate(current)) count += 1;
    const rendered = renderResolvableComponent(current);
    if (rendered !== null) {
      stack.push(rendered);
      continue;
    }
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }

  return count;
};
