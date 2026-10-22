import fs from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';

export async function until(read, accept = Boolean, {timeout = 5000, label = 'Expected condition'} = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { const value = await read(); if (accept(value)) return value; }
    catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    await sleep(20);
  }
  throw new Error(`${label} did not arrive within ${timeout}ms`);
}

export async function symlink(t, target, link) {
  const directory = (await fs.stat(target)).isDirectory();
  try { await fs.symlink(target, link, directory ? (process.platform === 'win32' ? 'junction' : 'dir') : 'file'); }
  catch (error) {
    if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) throw error;
    t.skip(`Symlinks unavailable: ${error.code}; enable Developer Mode or use a permitted account`);
    return false;
  }
  return true;
}
