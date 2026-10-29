import fs from 'node:fs/promises';
import path from 'node:path';

export const openCheckpoint = async (filePath, { resume = false } = {}) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const runs = [];
  if (!resume) {
    await fs.writeFile(filePath, '');
  } else {
    const raw = await fs.readFile(filePath).catch((error) => {
      if (error?.code === 'ENOENT') return Buffer.alloc(0);
      throw error;
    });
    let offset = 0;
    let lineNumber = 1;
    let truncated = false;
    while (offset < raw.length) {
      const newline = raw.indexOf(10, offset);
      const end = newline < 0 ? raw.length : newline;
      const line = raw.subarray(offset, end).toString('utf8').replace(/\r$/, '');
      if (line.length) {
        try {
          runs.push(JSON.parse(line));
        } catch (error) {
          if (newline >= 0) throw new Error(`checkpoint ${filePath} line ${lineNumber} is invalid JSON: ${error.message}`);
          // Keep byte offsets: an earlier record may contain multibyte text.
          await fs.truncate(filePath, offset);
          truncated = true;
          break;
        }
      }
      offset = end + 1;
      lineNumber += 1;
    }
    if (!truncated && raw.length && raw[raw.length - 1] !== 10) await fs.appendFile(filePath, '\n');
  }
  let queue = Promise.resolve();
  const write = async (runRecord) => {
    queue = queue.then(() => fs.appendFile(filePath, `${JSON.stringify(runRecord)}\n`));
    await queue;
  };
  return { runs, write };
};
