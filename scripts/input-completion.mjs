#!/usr/bin/env node
// One detached waiter and one completion message. Node built-ins only.
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn, fork} from 'node:child_process';
import {notification} from './completion/codex.mjs';

const cli = fileURLToPath(import.meta.url);
const plugin = path.resolve(path.dirname(cli), '..');
const output = value => process.stdout.write(JSON.stringify(value) + '\n');
const fallback = (session, reason) => ({status: 'fallback', session, reason, instruction: 'No new waiter was launched. Preserve this session and follow the shared completion policy. Never poll or restart an existing wait attempt; collect on done when automatic delivery is unavailable.'});
const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
export function completionCommand(session) {
  const argv = [process.execPath, cli, 'start', '--session', session];
  return {action: 'start', argv, command: argv.map(quote).join(' ')};
}
function argvJSON(value) {
  const argv = JSON.parse(value);
  if (!Array.isArray(argv) || !argv.length || argv.some(x => typeof x !== 'string' || x.includes('\0')) || !argv[0]) throw Error('--notify must be a nonempty JSON argv array');
  return argv;
}
function run(argv, timeout) {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), {stdio: ['ignore', 'pipe', 'pipe'], timeout});
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(stdout) : reject(Error(stderr.trim() || `Process exited ${code}`)));
  });
}
async function sessionJob(options) {
  if (options['timeout-seconds'] && (!/^[1-9]\d*$/.test(options['timeout-seconds']) || Number(options['timeout-seconds']) > 86400)) throw Error('--timeout-seconds must be an integer from 1 to 86400');
  if (!options.session || !path.isAbsolute(options.session)) throw Error('Supply the exact absolute --session path');
  const stat = await fs.lstat(options.session);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('Session must be a regular directory');
  let session = await fs.realpath(options.session);
  let state, kind;
  for (const [file, expected] of [['batch.json', 'jstack-capture-feedback'], ['session.json', 'jstack-grill-form']]) {
    try {
      if (!(await fs.lstat(path.join(session, file))).isFile()) throw Error('Invalid session marker');
      state = JSON.parse(await fs.readFile(path.join(session, file), 'utf8'));
      if (state.kind !== expected || typeof state.directory !== 'string' || !path.isAbsolute(state.directory)
          || await fs.realpath(state.directory) !== session || state.schemaVersion !== 1) throw Error('Invalid session identity');
      // Foundation and Node spell macOS /var aliases differently. Retain the
      // session's own path after verifying that it resolves to this directory.
      session = state.directory;
      kind = expected.slice('jstack-'.length); break;
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  if (!kind) throw Error('Not a feedback or grill-form session');
  const wait = kind === 'capture-feedback'
    ? [path.join(plugin, 'skills/capture-feedback/bin/Feedback.app/Contents/MacOS/Feedback'), 'wait']
    : [process.execPath, path.join(plugin, 'skills/grill-form/scripts/grill-form.mjs'), 'wait'];
  wait.push('--session', session);
  for (const key of ['timeout-seconds', 'downloads', 'answer']) {
    if (options[key]) {
      if (kind === 'capture-feedback' && key !== 'timeout-seconds') throw Error(`${key} only applies to grill-form`);
      wait.push('--' + key, options[key]);
    }
  }
  return {session, kind, wait};
}
async function start(options) {
  const job = await sessionJob(options);
  for (const name of ['completion.json', '.wait.started', '.wait.stop', 'wait.started.json', 'poll.stop']) {
    try { await fs.lstat(path.join(job.session, name)); return fallback(job.session, 'A collection or completion attempt already exists; it will not be restarted.'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  const transport = options.notify ? {name: 'custom', argv: argvJSON(options.notify)} : notification();
  if (!transport) return fallback(job.session, 'No compatible completion adapter is available.');
  const file = path.join(job.session, 'completion.json');
  try { await fs.writeFile(file, JSON.stringify({status: 'starting', transport: transport.name}), {flag: 'wx', mode: 0o600}); }
  catch (e) { if (e.code === 'EEXIST') return fallback(job.session, 'A completion attempt already exists; it will not be restarted.'); throw e; }
  const child = fork(cli, ['worker'], {detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc']});
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(Error('Completion worker failed to start')); }, 5000);
    child.once('error', e => { clearTimeout(timer); reject(e); });
    child.once('exit', code => { clearTimeout(timer); reject(Error(`Completion worker exited ${code} before starting`)); });
    child.once('message', () => { clearTimeout(timer); resolve(); });
    child.send({...job, transport});
  });
  child.disconnect(); child.unref();
  return {status: 'armed', session: job.session, transport: transport.name, instruction: 'End the turn. Submission will send one completion message to this conversation. Do not poll. If delivery fails, the saved session can still be collected when the user says done.'};
}
async function worker(job) {
  const file = path.join(job.session, 'completion.json');
  // Update only the file claimed by start; never recreate a finished session.
  async function save(value) {
    const handle = await fs.open(file, constants.O_RDWR | (constants.O_NOFOLLOW ?? 0));
    try {
      if (!(await handle.stat()).isFile()) throw Error('Completion state is not a regular file');
      await handle.truncate(); await handle.writeFile(JSON.stringify(value) + '\n');
    }
    finally { await handle.close(); }
  }
  try {
    const waiting = run(job.wait);
    process.send({status: 'armed'});
    const result = JSON.parse(await waiting);
    await save({status: 'completed', result});
    if (!['received', 'submitted'].includes(result.status)) return;
    const message = `Local jstack ${job.kind} submission is ready. Session: ${JSON.stringify(job.session)}. Follow that skill's collection and finish steps for this exact session. This notice contains no user answers; read the saved submission.`;
    await run(job.transport.argv.map(arg => arg === '{message}' ? message : arg), 15000);
    await save({status: 'notified', result});
  } catch (e) {
    try { await save({status: 'failed', error: e.message, instruction: 'Preserve the session and collect on done; do not restart automatically.'}); } catch { /* The session may have been finished or discarded. */ }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === cli) {
  if (process.argv[2] === 'worker' && process.send) {
    process.once('message', job => { void worker(job); });
  } else {
    try {
      if (process.argv[2] !== 'start') throw Error('Usage: input-completion.mjs start --session PATH [--notify JSON_ARGV]');
      const args = process.argv.slice(3), options = {};
      while (args.length) {
        const flag = args.shift(), value = args.shift(), key = flag?.slice(2);
        if (!flag?.startsWith('--') || !['session', 'notify', 'timeout-seconds', 'downloads', 'answer'].includes(key) || !value || Object.hasOwn(options, key)) throw Error(`Invalid option: ${flag}`);
        options[key] = value;
      }
      output(await start(options));
    } catch (e) { output({status: 'error', message: e.message, instruction: 'Preserve the session; use manual collection. Do not retry automatically.'}); process.exitCode = 1; }
  }
}
