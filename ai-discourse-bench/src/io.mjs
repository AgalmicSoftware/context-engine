import fs from 'node:fs/promises';
import path from 'node:path';

export const readJsonFile = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

export const readJsonFileIfExists = async (filePath, fallback = null) => {
  try {
    return await readJsonFile(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
};

export const writeJsonFile = async (filePath, value) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(`${filePath}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(`${filePath}.tmp`, filePath);
};

export const readTextFile = async (filePath) => fs.readFile(filePath, 'utf8');

export const writeTextFile = async (filePath, value) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value);
};

export const writeTextFileIfMissing = async (filePath, value) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.writeFile(filePath, value, { flag: 'wx' });
    return true;
  } catch (error) {
    if (error?.code === 'EEXIST') return false;
    throw error;
  }
};
