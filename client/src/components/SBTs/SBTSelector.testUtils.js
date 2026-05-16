import SBTSelector from './SBTSelector';

export const makeInstance = (props = {}) => {
  const instance = new SBTSelector({
    selectedSBTs: [],
    sessionSlug: 'edge',
    network: { id: 84532 },
    ...props,
  });
  instance.setState = (update, cb) => {
    const next = typeof update === 'function' ? update(instance.state, instance.props) : update;
    instance.state = { ...instance.state, ...(next || {}) };
    if (typeof cb === 'function') cb();
  };
  return instance;
};

export const findElement = (node, predicate) => {
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) continue;
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) stack.push(current[i]);
      continue;
    }
    if (typeof current !== 'object') continue;
    if (predicate(current)) return current;
    stack.push(current?.props?.children);
  }
  return null;
};

export const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

export const flushAsync = async (passes = 1) => {
  for (let i = 0; i < passes; i += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await Promise.resolve();
};
