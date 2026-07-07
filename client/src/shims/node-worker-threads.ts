// Browser shim for Node's worker_threads module.
// write-file-atomic only reads threadId; keep defaults stable and side-effect free.
module.exports = {
  threadId: 0,
  isMainThread: true,
  Worker: function Worker() {
    throw new Error('worker_threads is not available in browser builds');
  },
  parentPort: null,
};
