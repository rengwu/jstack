import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {notification} from './completion/codex.mjs';

const execute = promisify(execFile);
const helper = fileURLToPath(new URL('./input-completion.mjs', import.meta.url));
const grill = fileURLToPath(new URL('../skills/grill-form/scripts/grill-form.mjs', import.meta.url));
const capture = fileURLToPath(new URL('../skills/capture-feedback/bin/Feedback.app/Contents/MacOS/Feedback', import.meta.url));
const env = {...process.env, CODEX_THREAD_ID: ''}; // Tests must never message a real conversation.
const parse = result => { assert.equal(result.status, 0, result.stderr || result.stdout); return JSON.parse(result.stdout); };
const call = (argv, input) => parse(spawnSync(argv[0], argv.slice(1), {env, input: input && JSON.stringify(input), encoding: 'utf8', timeout: 5000}));
async function until(read, accept = Boolean) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try { const value = await read(); if (accept(value)) return value; }
    catch (e) { if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e; }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail('Local completion did not arrive within five seconds');
}
async function fixture(t, kind = 'grill-form') {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'jstack-completion-'));
  const project = path.join(temp, "project ' $ `literal`"); await fs.mkdir(project);
  const program = kind === 'grill-form' ? [process.execPath, grill] : [capture];
  const created = call([...program, 'create', '--project', project, ...(kind === 'grill-form' ? ['--temporary'] : ['--sessions', path.join(temp, 'sessions')])],
    {title: 'Synthetic input', questions: [{prompt: 'Pick one', recommendation: 'A', options: ['A', 'B']}]});
  const session = created.session, log = path.join(temp, 'notice.txt');
  t.after(async () => { await fs.rm(session, {recursive: true, force: true}); await fs.rm(temp, {recursive: true, force: true}); });
  const notify = JSON.stringify([process.execPath, '-e', 'require("node:fs").appendFileSync(process.argv[1], process.argv[2]+"\\n")', log, '{message}']);
  const args = ['start', '--session', session, ...(kind === 'grill-form' ? ['--downloads', temp] : [])];
  const complete = (...extra) => call([process.execPath, helper, ...args, ...extra]);
  const state = () => fs.readFile(path.join(session, 'completion.json'), 'utf8').then(JSON.parse);
  const settled = () => until(state, value => ['notified', 'failed', 'completed'].includes(value.status));
  const started = () => until(() => fs.stat(path.join(session, kind === 'grill-form' ? 'wait.started.json' : '.wait.started')));
  async function submit() {
    if (kind === 'grill-form') {
      const source = JSON.parse(await fs.readFile(path.join(session, 'session.json'), 'utf8'));
      await fs.writeFile(path.join(temp, created.answerFilename), JSON.stringify({schemaVersion: 1, sessionId: source.sessionId, specDigest: source.specDigest,
        answers: [{questionId: 'q1', choiceId: 'option1', notes: 'Synthetic answer'}]}));
    } else {
      const batch = JSON.parse(await fs.readFile(path.join(session, 'batch.json'), 'utf8')), id = randomUUID();
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64');
      await fs.writeFile(path.join(session, id + '.png'), png);
      batch.items = [{id, image: id + '.png', feedback: 'Synthetic capture feedback'}]; batch.status = 'submitted';
      await fs.writeFile(path.join(session, '.batch.next'), JSON.stringify(batch));
      await fs.rename(path.join(session, '.batch.next'), path.join(session, 'batch.json'));
    }
  }
  const collect = () => call([...program, 'collect', '--session', session, ...(kind === 'grill-form' ? ['--downloads', temp] : [])]);
  const finish = receipt => call([...program, 'finish', '--session', session, ...(kind === 'grill-form' ? ['--downloads', temp] : ['--receipt', receipt])]);
  return {temp, session, log, notify, args, complete, state, settled, started, submit, collect, finish};
}

for (const kind of ['grill-form', 'capture-feedback']) {
  test(`${kind}: silent detached wait sends one notice and preserves the collectible submission`, {skip: kind === 'capture-feedback' && process.platform !== 'darwin'}, async t => {
    const f = await fixture(t, kind), other = await fixture(t, kind);
    assert.equal(f.complete('--notify', f.notify).status, 'armed');
    await f.started();
    await assert.rejects(fs.stat(f.log), {code: 'ENOENT'});
    assert.equal(f.complete('--notify', f.notify).status, 'fallback');
    await other.submit(); // A different conversation must not complete this wait.
    assert.equal((await f.state()).status, 'starting');
    await assert.rejects(fs.stat(f.log), {code: 'ENOENT'});
    await f.submit();
    const done = await until(f.state, value => value.status === 'notified');
    assert.equal(done.result.status, 'received');
    const notices = (await fs.readFile(f.log, 'utf8')).trim().split('\n');
    assert.equal(notices.length, 1);
    assert.ok(notices[0].includes(JSON.stringify(f.session)));
    assert.ok(!notices[0].includes(other.session));
    const result = f.collect(); assert.equal(result.status, 'received');
    if (kind === 'capture-feedback') {
      assert.equal(result.items[0].feedback, 'Synthetic capture feedback');
      await fs.stat(result.items[0].image);
    } else assert.equal(result.answers[0].notes, 'Synthetic answer');
    const finished = f.finish(result.receipt); assert.equal(finished.status, 'finished');
    if (finished.record) { assert.match(await fs.readFile(finished.record, 'utf8'), /Synthetic answer/); await fs.unlink(finished.record); }
    await assert.rejects(fs.stat(f.session), {code: 'ENOENT'});
  });

  test(`${kind}: timeout and manual collection stop waiting without losing later submissions`, {skip: kind === 'capture-feedback' && process.platform !== 'darwin'}, async t => {
    for (const mode of ['timeout', 'manual']) {
      const f = await fixture(t, kind);
      assert.equal(f.complete('--notify', f.notify, '--timeout-seconds', mode === 'timeout' ? '1' : '30').status, 'armed');
      await f.started();
      if (mode === 'manual') assert.equal(f.collect().status, 'waiting');
      const done = await f.settled(); assert.equal(done.result.status, 'waiting');
      assert.equal(f.complete('--notify', f.notify).status, 'fallback');
      await f.submit(); assert.equal(f.collect().status, 'received');
      await assert.rejects(fs.stat(f.log), {code: 'ENOENT'});
    }
  });
}

test('unsupported host leaves the session untouched and returns a manual fallback', async t => {
  const f = await fixture(t), before = await fs.readdir(f.session);
  assert.equal(f.complete().status, 'fallback');
  assert.deepEqual(await fs.readdir(f.session), before);
  await f.submit(); assert.equal(f.collect().status, 'received');
});

test('concurrent starts claim only one completion attempt', async t => {
  const f = await fixture(t);
  const invoke = () => execute(process.execPath, [helper, ...f.args, '--notify', f.notify], {env}).then(result => JSON.parse(result.stdout));
  const results = await Promise.all([invoke(), invoke()]);
  assert.deepEqual(results.map(r => r.status).sort(), ['armed', 'fallback']);
  await f.submit(); await until(f.state, value => value.status === 'notified');
  assert.equal((await fs.readFile(f.log, 'utf8')).trim().split('\n').length, 1);
});

test('notification failure and malformed input never delete or retry a submission', async t => {
  const f = await fixture(t);
  const broken = JSON.stringify([path.join(f.temp, 'missing-command'), '{message}']);
  assert.equal(f.complete('--notify', broken).status, 'armed');
  await f.submit(); await until(f.state, value => value.status === 'failed');
  assert.equal(f.complete('--notify', f.notify).status, 'fallback');
  assert.equal(f.collect().status, 'received');
  await assert.rejects(fs.stat(f.log), {code: 'ENOENT'});
  const other = await fixture(t);
  const result = spawnSync(process.execPath, [helper, ...other.args, '--notify', '{}'], {env, encoding: 'utf8'});
  assert.equal(result.status, 1);
  await assert.rejects(fs.stat(path.join(other.session, 'completion.json')), {code: 'ENOENT'});
});

test('Codex adapter checks capability and requires an exact thread identity', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'jstack-codex-capability-'));
  t.after(() => fs.rm(temp, {recursive: true, force: true}));
  const file = path.join(temp, 'codex');
  await fs.writeFile(file, '#!/bin/sh\nprintf "%s\\n" "--thread --message"\n', {mode: 0o700});
  const adapted = {...env, PATH: temp, CODEX_THREAD_ID: randomUUID()};
  assert.deepEqual(notification(adapted).argv, ['codex', 'queue', '--thread', adapted.CODEX_THREAD_ID, '--message', '{message}']);
  assert.equal(notification({...adapted, CODEX_THREAD_ID: ''}), null);
  assert.equal(notification({...adapted, CODEX_THREAD_ID: 'latest'}), null);
  await fs.writeFile(file, '#!/bin/sh\nexit 1\n', {mode: 0o700});
  assert.equal(notification(adapted), null);
});
