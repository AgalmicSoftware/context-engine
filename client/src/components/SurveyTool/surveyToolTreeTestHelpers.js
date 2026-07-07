const getNodeTypeName = (node) => {
  const type = node?.type;
  if (!type) return '';
  if (typeof type === 'string') return type;
  if (typeof type === 'function') return String(type.displayName || type.name || '');
  if (typeof type === 'object') {
    return String(type.displayName || type.render?.displayName || type.render?.name || '');
  }
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

const resolvedComponentCache = new WeakMap();

const renderResolvableComponent = (node) => {
  const typeName = getNodeTypeName(node);
  if (!RESOLVABLE_SURVEY_TOOL_COMPONENTS.has(typeName)) return null;
  const type = node?.type;
  if (resolvedComponentCache.has(node)) return resolvedComponentCache.get(node);
  let rendered = null;
  if (typeof type === 'function') {
    rendered = type(node.props || {});
  } else if (type && typeof type.render === 'function') {
    rendered = type.render(node.props || {}, null);
  }
  resolvedComponentCache.set(node, rendered);
  return rendered;
};

export const treeHasDataTestId = (node, testId) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasDataTestId(child, testId));
  if (typeof node !== 'object') return false;
  if (node?.props?.['data-testid'] === testId) return true;
  const rendered = renderResolvableComponent(node);
  if (rendered !== null) return treeHasDataTestId(rendered, testId);
  return treeHasDataTestId(node?.props?.children, testId);
};

export const treeHasLabel = (node, label) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasLabel(child, label));
  if (typeof node !== 'object') return false;
  if (node?.props?.label === label) return true;
  const rendered = renderResolvableComponent(node);
  if (rendered !== null) return treeHasLabel(rendered, label);
  return treeHasLabel(node?.props?.children, label);
};

export const treeHasText = (node, text) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  const rendered = renderResolvableComponent(node);
  if (rendered !== null) return treeHasText(rendered, text);
  return treeHasText(node?.props?.children, text);
};

export const findElement = (node, predicate) => {
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

export const findFirstNodeByType = (node, targetType) => {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirstNodeByType(child, targetType);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  if (node?.type === targetType) return node;
  const rendered = renderResolvableComponent(node);
  if (rendered !== null) return findFirstNodeByType(rendered, targetType);
  return findFirstNodeByType(node?.props?.children, targetType);
};

export const nodeHasClassName = (node, className) => {
  const value = node?.props?.className;
  if (typeof value !== 'string') return false;
  return value.split(/\s+/).includes(className);
};

export const findNodeByClassName = (node, className) =>
  findElement(node, (candidate) => nodeHasClassName(candidate, className));

export const getElementChildren = (node) => {
  const children = node?.props?.children;
  if (children == null) return [];
  return (Array.isArray(children) ? children : [children]).filter((child) => child && typeof child === 'object');
};

export const countElements = (node, predicate) => {
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
