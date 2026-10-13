#!/usr/bin/env node
// Launch a collector with an optional notification command, then exit.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {notification} from './completion/codex.mjs';

export async function start(wait) {
  const transport = notification();
  if (!transport) return {status: 'fallback', reason: 'No completion adapter available'};
  return new Promise(resolve => {
    const child = spawn(wait[0], [...wait.slice(1), '--notify', JSON.stringify(transport.argv)],
      {detached: true, stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '', stderr = '', settled = false;
    const timer = setTimeout(() => { child.kill(); finish({status: 'error', message: 'Collector did not start'}); }, 5000);
    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout.destroy(); child.stderr.destroy(); child.unref();
      resolve(result);
    }
    child.stdout.on('data', data => {
      stdout += data;
      try { finish(JSON.parse(stdout)); } catch { /* Wait for the complete startup result. */ }
    });
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', error => finish({status: 'error', message: error.message}));
    child.once('close', code => {
      try { finish(JSON.parse(stderr)); }
      catch { finish({status: 'error', message: stderr.trim() || `Collector exited ${code}`}); }
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [separator, ...wait] = process.argv.slice(2);
  const result = separator === '--' && wait.length ? await start(wait)
    : {status: 'error', message: 'Usage: input-completion.mjs -- COLLECTOR wait [options]'};
  (result.status === 'error' ? process.stderr : process.stdout).write(JSON.stringify(result) + '\n');
  if (result.status === 'error') process.exitCode = 1;
}
