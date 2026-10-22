import {execFileSync} from 'node:child_process';

// Optional adapter. Older CLIs and other hosts keep using their own completion
// tools or manual collection; nothing is installed or configured here.
export function notification(env = process.env, run = execFileSync) {
  const thread = env.CODEX_THREAD_ID;
  if (!/^[a-f0-9-]{36}$/i.test(thread ?? '')) return null;
  try {
    const help = run('codex', ['queue', '--help'], {encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'], env});
    if (!help.includes('--thread') || !help.includes('--message')) return null;
    return {name: 'codex-queue', argv: ['codex', 'queue', '--thread', thread, '--message', '{message}']};
  } catch { return null; }
}
