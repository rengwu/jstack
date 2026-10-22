import {spawn} from 'node:child_process';

// Keep URLs out of shell source, including on Windows.
export function browserCommand(url, browser, platform = process.platform) {
  if (browser) return {argv: [browser, url], detached: true};
  if (platform === 'darwin') return {argv: ['open', url]};
  if (platform === 'win32') return {
    argv: ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference='Stop'; Start-Process -FilePath $env:JSTACK_FORM_URL"],
    env: {...process.env, JSTACK_FORM_URL: url},
  };
  return {argv: ['xdg-open', url]};
}

export async function openBrowser(url, browser, {spawnProcess = spawn, timeout = 5000} = {}) {
  const {argv, env, detached} = browserCommand(url, browser);
  return new Promise(resolve => {
    let child, timer, settled = false;
    function finish(result) {
      if (settled) return;
      settled = true; clearTimeout(timer); child?.unref(); resolve(result);
    }
    try {
      child = spawnProcess(argv[0], argv.slice(1), {env, detached, stdio: 'ignore', windowsHide: true});
      timer = setTimeout(() => {
        // An explicit browser may stay open; only stop a stuck OS launcher.
        if (!detached) child.kill();
        finish({status: 'fallback', reason: 'Browser launch timed out; open the returned HTML path'});
      }, timeout);
      child.once('error', error => finish({status: 'fallback', reason: error.message}));
      if (detached) child.once('spawn', () => finish({status: 'requested'}));
      child.once('exit', code => finish(code === 0 ? {status: 'requested'} : {status: 'fallback', reason: `Browser launcher exited ${code}`}));
    } catch (error) { finish({status: 'fallback', reason: error.message}); }
  });
}
