// Optional browser verification using an installed Chromium browser and Node built-ins.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

export async function chrome(t) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'jstack-chrome-'));
  const process = spawn(globalThis.process.env.GRILL_FORM_BROWSER, [
    '--headless=new', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync',
    '--disable-extensions', 'about:blank',
  ], {stdio: ['ignore', 'ignore', 'pipe']});
  let socket;
  t.after(async () => {
    socket?.close();
    if (process.exitCode === null && process.signalCode === null) { const exited = once(process, 'exit'); process.kill(); await exited; }
    await fs.rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
  });
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Browser debugging endpoint timed out: ' + output.slice(-1000))), 15000);
    process.once('error', error => { clearTimeout(timeout); reject(error); });
    process.stderr.on('data', chunk => {
      output += chunk;
      const found = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (found) { clearTimeout(timeout); resolve(found[1]); }
    });
  });
  socket = new WebSocket(endpoint);
  await once(socket, 'open');
  let id = 0;
  const pending = new Map(), events = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) { events.push(message); return; }
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id); clearTimeout(call.timeout);
    if (message.error) call.reject(new Error(JSON.stringify(message.error)));
    else call.resolve(message.result);
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const key = ++id;
      const timeout = setTimeout(() => { pending.delete(key); reject(new Error(method + ' timed out')); }, 15000);
      pending.set(key, {resolve, reject, timeout});
      socket.send(JSON.stringify({id: key, method, params, sessionId}));
    });
  }
  const {targetId} = await send('Target.createTarget', {url: 'about:blank'});
  const {sessionId} = await send('Target.attachToTarget', {targetId, flatten: true});
  const command = (method, params) => send(method, params, sessionId);
  await command('Page.enable'); await command('Runtime.enable'); await command('Network.enable');
  await command('Network.emulateNetworkConditions', {offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0});
  return {
    command, events,
    async evaluate(expression) {
      const result = await command('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    },
  };
}
