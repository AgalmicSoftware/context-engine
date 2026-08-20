import fs from 'node:fs/promises';
import path from 'node:path';

export const readCheckpointRuns = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const lastNonEmptyIndex = lines.findLastIndex((line) => line.length > 0);
    const hasTerminatingNewline = /\r?\n$/.test(raw);
    return lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.length > 0)
      .map(({ line, index }) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          if (index === lastNonEmptyIndex && !hasTerminatingNewline) return null;
          throw new Error(`checkpoint ${filePath} line ${index + 1} is invalid JSON: ${error.message}`);
        }
      })
      .filter(Boolean);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
};

export const createCheckpointWriter = async (filePath, { reset = false } = {}) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (reset) await fs.writeFile(filePath, '');
  let queue = Promise.resolve();
  return async (runRecord) => {
    queue = queue.then(() => fs.appendFile(filePath, `${JSON.stringify(runRecord)}\n`));
    await queue;
  };
};
