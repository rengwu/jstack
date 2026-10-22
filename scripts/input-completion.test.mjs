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
import {until} from './helpers/fixtures.mjs';

const execute = promisify(execFile);
const grill = fileURLToPath(new URL('../skills/grill-form/scripts/grill-form.mjs', import.meta.url));
const capture = fileURLToPath(new URL('../skills/screencap/bin/Screencap.app/Contents/MacOS/Screencap', import.meta.url));
const env = {...process.env, CODEX_THREAD_ID: ''}; // Tests must never message a real conversation.
const parse = result => { assert.equal(result.status, 0, result.stderr || result.stdout); return JSON.parse(result.stdout); };
const call = (argv, input) => parse(spawnSync(argv[0], argv.slice(1), {env, input: input && JSON.stringify(input), encoding: 'utf8', timeout: 5000}));
async function fixture(t, kind = 'grill-form') {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'jstack-completion-'));
  const project = path.join(temp, "project ' $ `literal`"); await fs.mkdir(project);
  const program = kind === 'grill-form' ? [process.execPath, grill] : [capture];
  const created = call([...program, 'create', '--project', project, ...(kind === 'grill-form' ? ['--temporary'] : ['--sessions', path.join(temp, 'sessions')])],
    {title: 'Synthetic input', questions: [{prompt: 'Pick one', recommendation: 'A', options: ['A', 'B']}]});
  const session = created.session, log = path.join(temp, 'notice.txt');
  t.after(async () => { await fs.rm(session, {recursive: true, force: true}); await fs.rm(temp, {recursive: true, force: true}); });
  const notifier = path.join(temp, 'notify.cjs');
  await fs.writeFile(notifier, `
if (process.env.JSTACK_TEST_NOTIFY_FAIL) process.exit(1);
require('node:fs').appendFileSync(process.env.JSTACK_TEST_NOTICE, process.argv.at(-1)+'\\n');
`);
  const testEnv = {...env, CODEX_THREAD_ID: randomUUID(), JSTACK_TEST_NOTICE: log};
  const runner = path.join(temp, 'complete.mjs');
  await fs.writeFile(runner, `
import {start} from ${JSON.stringify(new URL('./input-completion.mjs', import.meta.url).href)};
const transport = process.env.CODEX_THREAD_ID ? {argv:${JSON.stringify([process.execPath, notifier, '{message}'])}} : null;
const result = await start(${JSON.stringify(program)}.concat(process.argv.slice(2)), transport);
(result.status === 'error' ? process.stderr : process.stdout).write(JSON.stringify(result));
if (result.status === 'error') process.exitCode = 1;
`);
  const completionProgram = [process.execPath, runner];
  const args = ['wait', '--session', session, ...(kind === 'grill-form' ? ['--downloads', temp] : [])];
  const complete = (...extra) => parse(spawnSync(completionProgram[0], [...completionProgram.slice(1), ...args, ...extra], {env: testEnv, encoding: 'utf8', timeout: 5000}));
  const state = () => fs.readFile(path.join(session, '.wait'), 'utf8').then(value => value.trim());
  const settled = () => until(state, value => /^(notified|failed|received|timed_out|stopped)/.test(value));
  const started = () => until(state);
  async function submit() {
    if (kind === 'grill-form') {
      const source = JSON.parse(await fs.readFile(path.join(session, 'session.json'), 'utf8'));
      await fs.writeFile(path.join(temp, created.answerFilename), JSON.stringify({schemaVersion: 1, sessionId: source.sessionId, specDigest: source.specDigest,
        answers: [{questionId: 'q1', choiceId: 'option1', notes: 'Synthetic answer'}]}));
    } else {
      const batch = JSON.parse(await fs.readFile(path.join(session, 'batch.json'), 'utf8')), id = randomUUID();
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAXklEQVR4nO3PMQ0AMAzAsPInvYLYYVWKESTzjhsd8KsBrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BbQHKU9LC7/CP1AAAAABJRU5ErkJggg==', 'base64');
      await fs.writeFile(path.join(session, id + '.png'), png);
      batch.items = [{id, image: id + '.png', feedback: 'Synthetic capture feedback'}]; batch.status = 'submitted';
      await fs.writeFile(path.join(session, '.batch.next'), JSON.stringify(batch));
      await fs.rename(path.join(session, '.batch.next'), path.join(session, 'batch.json'));
    }
  }
  const collect = () => call([...program, 'collect', '--session', session, ...(kind === 'grill-form' ? ['--downloads', temp] : [])]);
  const finish = receipt => call([...program, 'finish', '--session', session, ...(kind === 'grill-form' ? ['--downloads', temp] : ['--receipt', receipt])]);
  return {temp, session, log, program, completionProgram, testEnv, args, complete, state, settled, started, submit, collect, finish};
}

for (const kind of ['grill-form', 'screencap']) {
  test(`${kind}: silent detached wait sends one notice and preserves the collectible submission`, {skip: kind === 'screencap' && process.platform !== 'darwin'}, async t => {
    const f = await fixture(t, kind), other = await fixture(t, kind);
    assert.equal(f.complete().status, 'armed');
    await f.started();
    await assert.rejects(fs.stat(f.log), {code: 'ENOENT'});
    assert.equal(f.complete().status, 'fallback');
    await other.submit(); // A different conversation must not complete this wait.
    assert.equal(await f.state(), 'waiting');
    await assert.rejects(fs.stat(f.log), {code: 'ENOENT'});
    await f.submit();
    const done = await until(f.state, value => value === 'notified');
    assert.equal(done, 'notified');
    assert.ok(!(await fs.readdir(f.session)).includes('completion.json'));
    const notices = (await fs.readFile(f.log, 'utf8')).trim().split('\n');
    assert.equal(notices.length, 1);
    assert.equal(notices[0], `${kind} ready: ${kind === 'grill-form' ? JSON.stringify(f.session) : f.session}`);
    assert.match(notices[0], new RegExp(`^${kind} ready: `));
    const result = f.collect(); assert.equal(result.status, 'received');
    if (kind === 'screencap') {
      assert.equal(result.items[0].feedback, 'Synthetic capture feedback');
      await fs.stat(result.items[0].image);
    } else assert.equal(result.answers[0].notes, 'Synthetic answer');
    const finished = f.finish(result.receipt); assert.equal(finished.status, 'finished');
    if (finished.record) { assert.match(await fs.readFile(finished.record, 'utf8'), /Synthetic answer/); await fs.unlink(finished.record); }
    await assert.rejects(fs.stat(f.session), {code: 'ENOENT'});
  });

  test(`${kind}: timeout and manual collection stop waiting without losing later submissions`, {skip: kind === 'screencap' && process.platform !== 'darwin'}, async t => {
    for (const mode of ['timeout', 'manual']) {
      const f = await fixture(t, kind);
      assert.equal(f.complete('--timeout-seconds', mode === 'timeout' ? '1' : '30').status, 'armed');
      await f.started();
      if (mode === 'manual') assert.equal(f.collect().status, 'waiting');
      const done = await f.settled(); assert.equal(done, mode === 'timeout' ? 'timed_out' : 'stopped');
      assert.equal(f.complete().status, 'fallback');
      await f.submit(); assert.equal(f.collect().status, 'received');
      await assert.rejects(fs.stat(f.log), {code: 'ENOENT'});
    }
  });

  test(`${kind}: startup errors and delivery failures preserve the submission`, {skip: kind === 'screencap' && process.platform !== 'darwin'}, async t => {
    const f = await fixture(t, kind);
    const invalid = spawnSync(f.completionProgram[0], [...f.completionProgram.slice(1), ...f.args, '--timeout-seconds', '0'], {env: f.testEnv, encoding: 'utf8'});
    assert.equal(invalid.status, 1);
    assert.equal(JSON.parse(invalid.stderr).status, 'error');
    await assert.rejects(fs.stat(path.join(f.session, '.wait')), {code: 'ENOENT'});
    f.testEnv.JSTACK_TEST_NOTIFY_FAIL = '1';
    assert.equal(f.complete().status, 'armed');
    await f.submit(); await until(f.state, value => value.startsWith('failed'));
    assert.equal(f.complete().status, 'fallback');
    assert.equal(f.collect().status, 'received');
    await assert.rejects(fs.stat(f.log), {code: 'ENOENT'});
  });

  test(`${kind}: old wait markers prevent an automatic restart`, {skip: kind === 'screencap' && process.platform !== 'darwin'}, async t => {
    const f = await fixture(t, kind);
    await fs.writeFile(path.join(f.session, 'completion.json'), '{}');
    assert.equal(f.complete().status, 'fallback');
    await assert.rejects(fs.stat(path.join(f.session, '.wait')), {code: 'ENOENT'});
    await f.submit(); assert.equal(f.collect().status, 'received');
  });
}

test('unsupported host leaves the session untouched and returns a manual fallback', async t => {
  const f = await fixture(t), before = await fs.readdir(f.session);
  assert.equal(call([...f.program, 'complete', '--session', f.session]).status, 'fallback');
  assert.deepEqual(await fs.readdir(f.session), before);
  await f.submit(); assert.equal(f.collect().status, 'received');
});

test('concurrent starts claim only one completion attempt', async t => {
  const f = await fixture(t);
  const invoke = () => execute(f.completionProgram[0], [...f.completionProgram.slice(1), ...f.args], {env: f.testEnv}).then(result => JSON.parse(result.stdout));
  const results = await Promise.all([invoke(), invoke()]);
  assert.deepEqual(results.map(r => r.status).sort(), ['armed', 'fallback']);
  await f.submit(); await until(f.state, value => value === 'notified');
  assert.equal((await fs.readFile(f.log, 'utf8')).trim().split('\n').length, 1);
});

test('malformed notification input leaves the session untouched', async t => {
  const other = await fixture(t);
  const result = spawnSync(other.program[0], [...other.program.slice(1), 'wait', '--session', other.session, '--notify', '{}'], {env, encoding: 'utf8'});
  assert.equal(result.status, 1);
  await assert.rejects(fs.stat(path.join(other.session, '.wait')), {code: 'ENOENT'});
});

test('Codex adapter checks capability and requires an exact thread identity', () => {
  const adapted = {...env, CODEX_THREAD_ID: randomUUID()};
  const supported = (program, argv, options) => {
    assert.equal(program, 'codex'); assert.deepEqual(argv, ['queue', '--help']);
    assert.equal(options.env, adapted); assert.equal(options.timeout, 5000);
    return '--thread --message';
  };
  assert.deepEqual(notification(adapted, supported).argv, ['codex', 'queue', '--thread', adapted.CODEX_THREAD_ID, '--message', '{message}']);
  const unexpected = () => { assert.fail('Invalid identity must not probe a CLI'); };
  assert.equal(notification({...adapted, CODEX_THREAD_ID: ''}, unexpected), null);
  assert.equal(notification({...adapted, CODEX_THREAD_ID: 'latest'}, unexpected), null);
  assert.equal(notification(adapted, () => '--message'), null);
  assert.equal(notification(adapted, () => { throw new Error('unavailable'); }), null);
});
