// Runs a Durable Object's operations in arrival order. An exclusive operation
// waits for everything before it and holds back everything after it. Shared
// operations between two exclusive ones run side by side, except that two
// with the same key still run one after the other.
const settled = (promise) => promise.then(() => undefined, () => undefined);

export const createOperationQueue = () => {
  let exclusiveTail = Promise.resolve();
  let allTail = Promise.resolve();
  const keyTails = new Map();
  return {
    exclusive(operation) {
      const run = allTail.then(() => operation());
      exclusiveTail = allTail = settled(run);
      return run;
    },
    shared(key, operation) {
      const before = key && keyTails.get(key);
      const run = (before ? Promise.all([exclusiveTail, before]) : exclusiveTail).then(() => operation());
      const done = settled(run);
      allTail = Promise.all([allTail, done]).then(() => undefined);
      if (key) {
        keyTails.set(key, done);
        done.then(() => { if (keyTails.get(key) === done) keyTails.delete(key); });
      }
      return run;
    },
  };
};
