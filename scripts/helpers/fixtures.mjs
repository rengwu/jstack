import fs from 'node:fs/promises';

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
