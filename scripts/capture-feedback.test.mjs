import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const binary = fileURLToPath(new URL('../skills/capture-feedback/bin/Feedback.app/Contents/MacOS/Feedback', import.meta.url));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAXklEQVR4nO3PMQ0AMAzAsPInvYLYYVWKESTzjhsd8KsBrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BbQHKU9LC7/CP1AAAAABJRU5ErkJggg==', 'base64');
const macTest = (name, fn) => test(name, {skip: process.platform !== 'darwin'}, fn);
const run = (...args) => spawnSync(binary, args, {encoding:'utf8', timeout:5000});
const ok = result => { assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); };
const bad = (result, pattern) => { assert.equal(result.status, 1, result.stderr); assert.match(JSON.parse(result.stderr).message, pattern); };
async function fixture(t) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'jstack-feedback-test-'));
  t.after(() => fs.rm(temporary, {recursive:true, force:true}));
  const parent = path.join(temporary, "sessions ' $ `quote`");
  const created = ok(run('create', '--project', temporary, '--sessions', parent));
  const root = created.session;
  const file = path.join(root, 'batch.json');
  const read = async () => JSON.parse(await fs.readFile(file, 'utf8'));
  const save = batch => fs.writeFile(file, JSON.stringify(batch));
  async function submitted() {
    const batch = await read(), id = randomUUID();
    batch.items.push({id, image:id+'.png', feedback:'Make the heading easier to read.'});
    batch.status = 'submitted';
    await fs.writeFile(path.join(root, id+'.png'), png, {mode:0o600});
    await save(batch);
    return batch;
  }
  return {...created, temporary, file, read, save, submitted,
    collect: () => run('collect', '--session', root),
    finish: receipt => run('finish', '--session', root, '--receipt', receipt),
  };
}

macTest('committed app is universal, signed, and matches its source plist', async () => {
  const app = path.resolve(binary, '../../..');
  assert.match(spawnSync('/usr/bin/lipo', ['-archs', binary], {encoding:'utf8'}).stdout, /x86_64 arm64|arm64 x86_64/);
  const signature = spawnSync('/usr/bin/codesign', ['--verify', '--strict', app], {encoding:'utf8'});
  assert.equal(signature.status, 0, signature.stderr);
  assert.equal(await fs.readFile(path.join(app, 'Contents/Info.plist'), 'utf8'),
    await fs.readFile(new URL('../skills/capture-feedback/native/Info.plist', import.meta.url), 'utf8'));
});

macTest('native note layout grows without clipping or nested scrolling', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'jstack-feedback-layout-'));
  t.after(() => fs.rm(temporary, {recursive:true, force:true}));
  const executable = path.join(temporary, 'layout-test');
  const source = fileURLToPath(new URL('./capture-feedback-layout.m', import.meta.url));
  const built = spawnSync('/usr/bin/xcrun', ['clang', '-fobjc-arc', '-Wall', '-Wextra', '-Werror', '-Wno-unused-parameter',
    '-framework', 'AppKit', '-framework', 'ImageIO', source, '-o', executable], {encoding:'utf8', timeout:30000});
  assert.equal(built.status, 0, built.stderr);
  const checked = spawnSync(executable, [], {encoding:'utf8', timeout:10000});
  assert.equal(checked.status, 0, checked.stderr);
});

macTest('create isolates sessions, restricts permissions, and draft collection checks once', async t => {
  const f = await fixture(t);
  assert.equal((await fs.stat(f.session)).mode & 0o777, 0o700);
  assert.equal((await fs.stat(f.file)).mode & 0o777, 0o600);
  assert.equal(ok(f.collect()).status, 'waiting');
  assert.match(f.next.command, /launch/);
  assert.match(f.wait.command, /wait/);
  assert.match(f.completion.command, /complete/);
  assert.ok((await fs.stat(f.completion.argv[0])).isFile());
  const other = ok(run('create', '--project', f.temporary, '--sessions', path.dirname(f.session)));
  assert.notEqual(other.session, f.session);
  bad(f.finish('a'.repeat(64)), /not been submitted/);
});

macTest('collection pairs full paths and feedback, preserves files, and finish requires exact receipt', async t => {
  const f = await fixture(t), batch = await f.submitted();
  const received = ok(f.collect());
  assert.equal(received.status, 'received');
  assert.equal(await fs.realpath(received.project), await fs.realpath(f.temporary));
  assert.deepEqual(received.items, [{image:path.join(f.session, batch.items[0].image), feedback:batch.items[0].feedback}]);
  assert.equal(received.receipt.length, 64);
  assert.deepEqual(ok(f.collect()), received);
  await fs.stat(received.items[0].image);
  bad(f.finish('0'.repeat(64)), /receipt/);
  assert.equal(ok(f.finish(received.receipt)).status, 'finished');
  await assert.rejects(fs.stat(f.session), {code:'ENOENT'});
});

macTest('changed notes or image data invalidate a collected receipt', async t => {
  const f = await fixture(t), batch = await f.submitted();
  const first = ok(f.collect());
  batch.items[0].feedback = 'A later correction'; await f.save(batch);
  bad(f.finish(first.receipt), /receipt/);
  const second = ok(f.collect());
  await fs.appendFile(second.items[0].image, Buffer.from('changed'));
  bad(f.finish(second.receipt), /receipt/);
  await fs.stat(f.file);
});

macTest('finish preflights unexpected files before deleting any captures', async t => {
  const f = await fixture(t); await f.submitted();
  const result = ok(f.collect()), unexpected = path.join(f.session, 'important.txt');
  await fs.writeFile(unexpected, 'keep');
  bad(f.finish(result.receipt), /Unexpected session file/);
  await fs.stat(result.items[0].image); await fs.stat(f.file);
  assert.equal(await fs.readFile(unexpected, 'utf8'), 'keep');
});

macTest('session symlinks, image traversal, duplicate images, and blank submissions are refused', async t => {
  const f = await fixture(t), batch = await f.submitted();
  const alias = path.join(f.temporary, 'alias'); await fs.symlink(f.session, alias);
  bad(run('collect', '--session', alias), /regular directory/);
  for (const mutate of [
    copy => { copy.items[0].image = '../outside.png'; },
    copy => { copy.items.push(copy.items[0]); },
    copy => { copy.items[0].feedback = '  '; },
    copy => { copy.directory = f.temporary; },
  ]) {
    const copy = structuredClone(batch); mutate(copy); await f.save(copy);
    assert.equal(f.collect().status, 1);
  }
  await f.save(batch); assert.equal(ok(f.collect()).status, 'received');
});

macTest('collector refuses symlinked captures and never removes the outside target', async t => {
  const f = await fixture(t), batch = await f.submitted();
  const image = path.join(f.session, batch.items[0].image), target = path.join(f.temporary, 'outside.png');
  await fs.rename(image, target); await fs.symlink(target, image);
  bad(f.collect(), /regular file/);
  assert.deepEqual(await fs.readFile(target), png);
});

macTest('shell commands quote session paths containing metacharacters', async t => {
  const f = await fixture(t);
  const command = f.next.command.replace("'launch'", "'collect'");
  assert.equal(ok(spawnSync('/bin/sh', ['-c', command], {encoding:'utf8'})).status, 'waiting');
});

macTest('invalid commands and missing projects do not create a session', async t => {
  const f = await fixture(t);
  bad(run('create', '--project', path.join(f.temporary, 'missing')), /Cannot read/);
  bad(run('finish', '--session', f.session, '--discard', 'true'), /Unknown/);
  bad(run('collect', '--session', f.session, '--session', f.session), /repeated/);
});
