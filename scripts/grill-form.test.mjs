import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {normalizeSpec, validateSubmission, IMAGE_LIMITS} from '../skills/grill-form/scripts/model.mjs';
import {chrome} from './helpers/chrome.mjs';

const cli = fileURLToPath(new URL('../skills/grill-form/scripts/grill-form.mjs', import.meta.url));
const template = fileURLToPath(new URL('../skills/grill-form/assets/form.template.html', import.meta.url));
const spec = {title: 'Test decisions', questions: [
  {id: 'audience', number: 8, prompt: 'Who edits?', recommendation: 'One owner keeps it simple.', options: [{id: 'owner', label: 'One owner'}, {id: 'team', label: 'A team'}]},
  {id: 'publish', number: 9, prompt: 'When to publish?', recommendation: 'Explicit publish allows review.', options: [{id: 'explicit', label: 'Explicit publish'}, {id: 'auto', label: 'Autosave'}]},
]};
const run = (args, input) => spawnSync(process.execPath, [cli, ...args], {input: input && JSON.stringify(input), encoding: 'utf8', timeout: 5000});
const ok = r => { assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
const bad = (r, re) => { assert.equal(r.status, 1); assert.match(r.stderr, re); };
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=';
function withImage(payload, dataUrl = png) {
  const copy = structuredClone(payload);
  copy.answers[0].notes = '  Match [Image #1] here, not the literal [Image #1].';
  copy.answers[0].images = [{id: 1, offset: 8, dataUrl}];
  return copy;
}
async function fixture(t, input = spec, createArgs = []) {
  const downloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jstack-grill-downloads-'));
  const projectPath = path.join(downloadDir, 'project'); await fs.mkdir(projectPath);
  const project = await fs.realpath(projectPath);
  const created = ok(run(['create', '--project', project, ...createArgs], input));
  t.after(async () => { await fs.rm(downloadDir, {recursive: true, force: true}); await fs.rm(created.session, {recursive: true, force: true}); });
  const state = JSON.parse(await fs.readFile(path.join(created.session, 'session.json'), 'utf8'));
  const payload = {schemaVersion: 1, sessionId: state.sessionId, specDigest: state.specDigest, answers: [
    {questionId: 'audience', choiceId: 'owner', notes: 'Start small'},
    {questionId: 'publish', choiceId: null, notes: 'Preview first, then publish manually.'},
  ]};
  const answer = path.join(downloadDir, created.answerFilename);
  return {...created, state, payload, answer, downloadDir, project,
    write: (value = payload, file = answer) => fs.writeFile(file, JSON.stringify(value)),
    collect: (...args) => run(['collect', '--session', created.session, '--downloads', downloadDir, ...args]),
    poll: () => run(['poll', '--session', created.session, '--downloads', downloadDir, '--max-wait-seconds', '1']),
    cleanup: (...args) => run(['cleanup', '--session', created.session, '--downloads', downloadDir, ...args]),
    finish: (...args) => run(['finish', '--session', created.session, '--downloads', downloadDir, ...args]),
  };
}

test('create emits one offline HTML and one state file, with safely escaped question data', async t => {
  const input = structuredClone(spec);
  input.title = '</script><script>alert(1)</script>& $&';
  input.questions[0].prompt = '<img src=x onerror=alert(2)>';
  const f = await fixture(t, input);
  assert.deepEqual((await fs.readdir(f.session)).sort(), ['form.html', 'session.json']);
  const html = await fs.readFile(f.html, 'utf8');
  assert.ok(Buffer.byteLength(html) < 60000);
  assert.doesNotMatch(html, /<img src=x|<script>alert|<script[^>]+src=|fetch\(|XMLHttpRequest|WebSocket|__GRILL_FORM_DATA__/);
  assert.match(html, /connect-src 'none'/);
  const embedded = JSON.parse(html.match(/<script type="application\/json" id="grill-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(embedded.projectName, path.basename(f.project));
  assert.equal(embedded.spec.title, input.title);
  assert.equal(embedded.spec.questions[0].number, 8);
  assert.match(f.url, /^file:\/\//);
});

test('collect checks once and persists a stop marker without scheduling an automatic retry', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.downloadDir, 'unrelated.json'), 'private');
  const result = ok(f.collect());
  assert.equal(result.status, 'waiting');
  assert.equal(result.next.action, 'collect');
  assert.ok(!result.next.argv.includes('--wait-seconds'));
  assert.deepEqual((await fs.readdir(f.session)).sort(), ['.wait', 'form.html', 'session.json']);
  bad(f.collect('--wait-seconds', '45'), /Unknown or repeated option/);
});

test('answers survive interrupted receipt; cleanup preserves unrelated files', async t => {
  const f = await fixture(t); await f.write();
  const unrelated = path.join(f.downloadDir, 'keep.json'); await fs.writeFile(unrelated, 'keep');
  const received = ok(f.collect());
  assert.equal(received.status, 'received');
  assert.equal(received.answers[0].choice, 'One owner');
  assert.equal(received.answers[1].choice, null);
  assert.equal(received.answers[1].notes, f.payload.answers[1].notes);
  assert.equal(ok(f.collect()).recovered, true);
  const finished = ok(f.finish());
  assert.equal(finished.status, 'finished');
  assert.match(await fs.readFile(finished.record, 'utf8'), /Preview first, then publish manually/);
  await assert.rejects(fs.stat(f.session), {code: 'ENOENT'});
  await assert.rejects(fs.stat(f.answer), {code: 'ENOENT'});
  assert.equal(await fs.readFile(unrelated, 'utf8'), 'keep');
});

test('temporary interviews preserve answers outside the project and clean up the session', async t => {
  const f = await fixture(t, spec, ['--temporary']);
  const record = path.join(await fs.realpath(os.tmpdir()), `${f.state.createdAt.slice(0, 10)}-grill-${f.state.sessionId}.md`);
  t.after(() => fs.rm(record, {force: true}));
  await f.write();
  assert.equal(ok(f.collect()).status, 'received');
  const finished = ok(f.finish());
  assert.equal(finished.record, record);
  assert.match(await fs.readFile(record, 'utf8'), /Preview first, then publish manually/);
  assert.deepEqual(await fs.readdir(f.project), []);
  await assert.rejects(fs.stat(f.session), {code: 'ENOENT'});
  await assert.rejects(fs.stat(f.answer), {code: 'ENOENT'});
});

test('inline images survive interrupted collection and finish in temporary and wiki transcripts', async t => {
  for (const temporary of [false, true]) {
    const f = await fixture(t, spec, temporary ? ['--temporary'] : []);
    await f.write(withImage(f.payload));
    const received = ok(f.collect());
    assert.equal(received.answers[0].notes, withImage(f.payload).answers[0].notes);
    assert.deepEqual(received.answers[0].images, [{id: 1, offset: 8, mimeType: 'image/png', bytes: Buffer.from(png.split(',')[1], 'base64').length}]);
    assert.equal(ok(f.collect()).recovered, true);
    const finished = ok(f.finish());
    if (temporary) t.after(async () => { await fs.rm(finished.record); await fs.rm(path.dirname(finished.images[0].path), {recursive: true}); });
    const body = await fs.readFile(finished.record, 'utf8');
    assert.ok(body.includes(withImage(f.payload).answers[0].notes));
    assert.ok(body.includes(`![Image #1](${temporary ? '' : '../attachments/'}${path.basename(path.dirname(finished.images[0].path))}/image-1.png)`));
    assert.deepEqual(await fs.readFile(finished.images[0].path), Buffer.from(png.split(',')[1], 'base64'));
    await assert.rejects(fs.stat(f.answer), {code: 'ENOENT'});
    await assert.rejects(fs.stat(f.session), {code: 'ENOENT'});
    if (temporary) assert.deepEqual(await fs.readdir(f.project), []);
    else {
      const wiki = path.join(f.project, 'docs/wiki'), builder = path.join(wiki, '_build.mjs');
      await fs.copyFile(fileURLToPath(new URL('../skills/wiki/assets/_build.mjs', import.meta.url)), builder);
      await fs.writeFile(path.join(wiki, 'index.md'), `# Project\n\n[Answers](journal/${path.basename(finished.record)})\n`);
      for (const args of [[], ['--check']]) {
        const result = spawnSync(process.execPath, [builder, ...args], {encoding: 'utf8'});
        assert.equal(result.status, 0, result.stderr);
      }
    }
  }
});

test('image submissions larger than the old text limit are collectible without dumping base64', async t => {
  const f = await fixture(t);
  const bytes = Buffer.alloc(2_100_000); Buffer.from(png.split(',')[1], 'base64').copy(bytes);
  await f.write(withImage(f.payload, 'data:image/png;base64,' + bytes.toString('base64')));
  assert.ok((await fs.stat(f.answer)).size > 2_000_000);
  const received = ok(f.collect());
  assert.equal(received.answers[0].images[0].bytes, bytes.length);
  assert.equal(received.answers[0].images[0].dataUrl, undefined);
  const finished = ok(f.finish());
  assert.deepEqual(await fs.readFile(finished.images[0].path), bytes);
});

test('invalid inline image references, encodings, types and limits preserve answer downloads', async t => {
  const f = await fixture(t);
  const variants = [
    {id: '../outside'}, {id: 0}, {offset: 9}, {offset: -1},
    {dataUrl: 'https://example.invalid/image.png'}, {dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+'},
    {dataUrl: 'data:image/png;base64,Zm9v'}, {dataUrl: png + '!'},
    {dataUrl: 'data:image/jpeg;base64,' + png.split(',')[1]},
    {dataUrl: 'data:image/png;base64,' + Buffer.alloc(IMAGE_LIMITS.fileBytes + 1).toString('base64')},
  ];
  for (const changes of variants) {
    const payload = withImage(f.payload); Object.assign(payload.answers[0].images[0], changes);
    await f.write(payload); assert.equal(f.collect().status, 1); await fs.stat(f.answer);
  }
  const duplicate = withImage(f.payload);
  duplicate.answers[1].notes = '[Image #1]'; duplicate.answers[1].images = [{id: 1, offset: 0, dataUrl: png}];
  await f.write(duplicate); bad(f.collect(), /duplicate image id/);
  const tooMany = withImage(f.payload);
  tooMany.answers[0].notes = Array.from({length: 21}, (_, i) => `[Image #${i + 1}]`).join(' ');
  tooMany.answers[0].images = Array.from({length: 21}, (_, i) => ({id: i + 1, offset: tooMany.answers[0].notes.indexOf(`[Image #${i + 1}]`), dataUrl: png}));
  await f.write(tooMany); bad(f.collect(), /Too many inline images/);
  await assert.rejects(fs.stat(path.join(f.session, 'receipt.json')), {code: 'ENOENT'});
});

test('finish preserves edited or symlinked image copies and retries without losing sources', async t => {
  const f = await fixture(t); await f.write(withImage(f.payload)); ok(f.collect());
  const unexpected = path.join(f.session, 'keep.txt'); await fs.writeFile(unexpected, 'keep');
  bad(f.finish(), /Unexpected files/);
  const attachments = path.join(f.project, 'docs/wiki/attachments');
  const [imageDirectory] = await fs.readdir(attachments);
  const image = path.join(attachments, imageDirectory, 'image-1.png');
  await fs.writeFile(image, 'edited'); bad(f.finish(), /Saved image changed/); await fs.stat(f.answer);
  const elsewhere = path.join(f.downloadDir, 'original.png'); await fs.writeFile(elsewhere, Buffer.from(png.split(',')[1], 'base64'));
  await fs.unlink(image); await fs.symlink(elsewhere, image); bad(f.finish(), /Not a regular file/); await fs.stat(f.answer);
  await fs.unlink(image); await fs.unlink(unexpected);
  assert.equal(ok(f.finish()).images[0].path, image);
  assert.deepEqual(await fs.readFile(image), await fs.readFile(elsewhere));
});

test('the plugin can be interviewed only in temporary mode', async t => {
  const project = fileURLToPath(new URL('../', import.meta.url));
  bad(run(['create', '--project', project], spec), /not the jstack plugin directory/);
  const created = ok(run(['create', '--project', project, '--temporary'], spec));
  t.after(() => fs.rm(created.session, {recursive: true, force: true}));
  const state = JSON.parse(await fs.readFile(path.join(created.session, 'session.json'), 'utf8'));
  assert.equal(state.projectName, 'jstack');
  assert.equal(ok(run(['collect', '--session', created.session])).status, 'waiting');
  assert.equal(ok(run(['cleanup', '--session', created.session, '--discard'])).status, 'cleaned');
});

test('wrong round, duplicate/missing questions, invalid options, and empty custom answers are rejected without deletion', async t => {
  const f = await fixture(t);
  const variants = [
    {...f.payload, sessionId: 'wrong'}, {...f.payload, specDigest: 'wrong'},
    {...f.payload, answers: [f.payload.answers[0]]},
    {...f.payload, answers: [f.payload.answers[0], f.payload.answers[0]]},
    {...f.payload, answers: [{...f.payload.answers[0], choiceId: 'invented'}, f.payload.answers[1]]},
    {...f.payload, answers: [{...f.payload.answers[0], choiceId: 'other', notes: '  '}, f.payload.answers[1]]},
  ];
  for (const value of variants) {
    await f.write(value); assert.equal(f.collect().status, 1);
    assert.equal(await fs.readFile(f.answer, 'utf8'), JSON.stringify(value));
  }
  await assert.rejects(fs.stat(path.join(f.session, 'receipt.json')), {code: 'ENOENT'});
});

test('duplicate downloads are collected together; conflicting answers require selection', async t => {
  const f = await fixture(t); await f.write();
  const duplicate = f.answer.replace('.json', ' (1).json');
  const changed = structuredClone(f.payload); changed.answers[0].choiceId = 'team';
  await f.write(changed, duplicate);
  bad(f.collect(), /Conflicting submissions/);
  await f.write(f.payload, duplicate);
  ok(f.collect()); ok(f.finish());
  await assert.rejects(fs.stat(duplicate), {code: 'ENOENT'});
});

test('renamed answer files are accepted only through an explicit path and cleaned by exact receipt', async t => {
  const f = await fixture(t), renamed = path.join(f.downloadDir, 'my answers.json');
  await f.write(f.payload, renamed);
  assert.equal(ok(f.collect()).status, 'waiting');
  assert.equal(ok(f.collect('--answer', renamed)).status, 'received');
  ok(f.finish());
  await assert.rejects(fs.stat(renamed), {code: 'ENOENT'});
});

test('cleanup refuses changed answers, unexpected session files, and uncollected sessions', async t => {
  const f = await fixture(t);
  bad(f.finish(), /Collect the answers/);
  await f.write(); ok(f.collect());
  await fs.appendFile(f.answer, ' ');
  bad(f.finish(), /changed/);
  await fs.stat(f.html); await f.write();
  await fs.writeFile(path.join(f.session, 'important.txt'), 'keep');
  bad(f.finish(), /Unexpected files/);
  await fs.stat(f.answer);
  await fs.unlink(path.join(f.session, 'important.txt'));
  ok(f.finish());
});

test('cleanup refuses modified forms, symlinked answers, and symlinked session directories', async t => {
  const f = await fixture(t); await f.write();
  const alias = path.join(f.downloadDir, 'grill-form-alias'); await fs.symlink(f.session, alias);
  bad(run(['cleanup', '--session', alias, '--discard']), /Not a grill-form session/);
  const target = path.join(f.downloadDir, 'actual.json'); await fs.rename(f.answer, target); await fs.symlink(target, f.answer);
  bad(f.collect(), /Not a regular file/); await fs.unlink(f.answer); await fs.rename(target, f.answer);
  ok(f.collect()); await fs.appendFile(f.html, '<!-- changed -->');
  bad(f.finish(), /Form was modified/); await fs.stat(f.answer);
});

test('explicit cancellation removes only owned temporary data and requires a flag', async t => {
  const f = await fixture(t);
  bad(f.cleanup(), /Use finish/);
  await fs.writeFile(path.join(f.session, '.DS_Store'), 'Finder folder metadata');
  assert.equal(ok(f.cleanup('--discard')).status, 'cleaned');
});

test('creation offers completion and a portable wait; legacy polling stays manual', async t => {
  const f = await fixture(t);
  assert.equal(f.next.action, 'collect');
  assert.equal(f.wait.action, 'wait');
  assert.equal(f.completion.action, 'complete');
  const legacy = ok(f.poll());
  assert.equal(legacy.next.action, 'collect');
  await f.write();
  assert.equal(ok(f.collect()).status, 'received');
  ok(f.finish());
});

function backgroundWait(t, f, extra = []) {
  const child = spawn(process.execPath, [cli, 'wait', '--session', f.session, '--downloads', f.downloadDir, ...extra], {stdio: ['ignore', 'pipe', 'pipe']});
  t.after(() => child.kill());
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const finished = new Promise(resolve => child.on('close', status => resolve({status, stdout, stderr})));
  return {finished, output: () => stdout};
}
async function waitStarted(f) {
  const deadline = Date.now() + 3000;
  while (!(await fs.readdir(f.session)).includes('.wait')) {
    assert.ok(Date.now() < deadline, 'local wait must start');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

test('one background process stays silent until a download arrives', async t => {
  const f = await fixture(t), wait = backgroundWait(t, f);
  await waitStarted(f);
  assert.equal(wait.output(), '');
  await f.write();
  const received = ok(await wait.finished);
  assert.equal(received.status, 'received');
  assert.equal(received.next.action, 'finish');
  assert.equal(ok(f.finish()).status, 'finished');
});

test('done stops the local wait; stale waits cannot restart it', async t => {
  const f = await fixture(t), wait = backgroundWait(t, f);
  await waitStarted(f);
  assert.equal(ok(f.collect()).next.action, 'collect');
  assert.equal(ok(await wait.finished).next.action, 'collect');
  assert.equal(ok(run(['wait', '--session', f.session])).next.action, 'collect');
  await f.write();
  assert.equal(ok(f.collect()).status, 'received');
  ok(f.finish());
});

test('timeout preserves the draft and returns only manual collection, including on retry', async t => {
  const f = await fixture(t);
  const result = ok(run(['wait', '--session', f.session, '--downloads', f.downloadDir, '--timeout-seconds', '1']));
  assert.equal(result.next.action, 'collect');
  await fs.stat(f.html);
  await f.write();
  assert.equal(ok(run(['wait', '--session', f.session])).next.action, 'collect');
  assert.equal(ok(f.collect()).status, 'received');
  ok(f.finish());
});

test('local wait errors stop without deleting invalid answers', async t => {
  const f = await fixture(t);
  await f.write({...f.payload, sessionId: 'wrong'});
  bad(run(['wait', '--session', f.session, '--downloads', f.downloadDir]), /different session/);
  await fs.stat(f.answer);
  await f.write();
  assert.equal(ok(run(['wait', '--session', f.session])).next.action, 'collect');
  assert.equal(ok(f.collect()).status, 'received');
  ok(f.finish());
  for (const seconds of ['0', '-1', '86401', '1.5']) bad(run(['wait', '--session', f.session, '--timeout-seconds', seconds]), /must be an integer/);
});

test('question schema enforces round boundaries and collector uses authoritative labels', () => {
  assert.throws(() => normalizeSpec({...spec, questions: []}), /1–10/);
  assert.throws(() => normalizeSpec({...spec, questions: Array(11).fill(spec.questions[0])}), /1–10/);
  const repeated = structuredClone(spec); repeated.questions[1].id = repeated.questions[0].id;
  assert.throws(() => normalizeSpec(repeated), /Duplicate/);
  const state = {sessionId: 'test', specDigest: 'digest', spec: normalizeSpec(spec)};
  const incoming = {schemaVersion: 1, sessionId: 'test', specDigest: 'digest', answers: spec.questions.map(q => ({questionId: q.id, choiceId: q.options[0].id, notes: '', question: 'forged', choice: 'forged'}))};
  assert.equal(validateSubmission(state, incoming).answers[0].choice, 'One owner');
});

test('prepared template stays standalone and framework-free', async () => {
  const html = await fs.readFile(template, 'utf8');
  assert.equal(html.split('__GRILL_FORM_DATA__').length, 2);
  assert.doesNotMatch(html.replaceAll('http://www.w3.org/2000/svg', ''), /https?:\/\/|node_modules|React|@base-ui|<link|<iframe|<script[^>]+src=/);
  assert.match(html, /fieldset/); assert.match(html, /notes-editor/); assert.match(html, /type="submit"/);
});

test('plain-string options get stable IDs and returned commands drive collection through durable finish', async t => {
  const input = {title: 'Simple round', questions: [{number: 8, prompt: 'Who edits?', recommendation: 'One owner keeps it simple.', options: ['One owner', 'A team']}]};
  const f = await fixture(t, input);
  assert.equal(f.state.spec.questions[0].id, 'q8');
  assert.deepEqual(f.state.spec.questions[0].options.map(o => o.id), ['option1', 'option2']);
  const custom = path.join(f.downloadDir, "space ' dollar $ and `ticks`"); await fs.mkdir(custom);
  const waiting = ok(run(['collect', '--session', f.session, '--downloads', custom]));
  assert.equal(waiting.next.action, 'collect');
  const payload = {...f.payload, answers: [{questionId: 'q8', choiceId: 'option2', notes: 'Prefer a team.'}]};
  const answer = path.join(custom, f.answerFilename); await fs.writeFile(answer, JSON.stringify(payload));
  const execute = next => spawnSync('/bin/sh', ['-c', next.command], {cwd: os.tmpdir(), encoding: 'utf8'});
  const received = ok(execute(waiting.next));
  assert.equal(received.answers[0].choice, 'A team');
  const finished = ok(execute(received.next));
  assert.equal(finished.status, 'finished');
  assert.equal(finished.next.action, 'interpret');
  assert.ok(finished.record.startsWith(f.project + path.sep));
  assert.match(await fs.readFile(finished.record, 'utf8'), /Prefer a team/);
  await assert.rejects(fs.stat(answer), {code: 'ENOENT'});
  await assert.rejects(fs.stat(f.session), {code: 'ENOENT'});
});

test('finish survives a cleanup failure, refuses edited transcripts, and can retry without duplicate records', async t => {
  const f = await fixture(t); await f.write(); ok(f.collect());
  const unexpected = path.join(f.session, 'keep.txt'); await fs.writeFile(unexpected, 'keep');
  bad(f.finish(), /Unexpected files/);
  const journal = path.join(f.project, 'docs/wiki/journal');
  const [name] = await fs.readdir(journal), record = path.join(journal, name);
  const original = await fs.readFile(record, 'utf8');
  await fs.appendFile(record, '\nUser edits\n');
  bad(f.finish(), /Saved transcript changed/); await fs.stat(f.answer);
  await fs.writeFile(record, original); await fs.unlink(unexpected);
  assert.equal(ok(f.finish()).record, record);
  assert.deepEqual(await fs.readdir(journal), [name]);
});

test('finish never follows a symlinked wiki destination or removes the only answer copy', async t => {
  const f = await fixture(t); await f.write(); ok(f.collect());
  const elsewhere = path.join(f.downloadDir, 'elsewhere'); await fs.mkdir(elsewhere);
  await fs.symlink(elsewhere, path.join(f.project, 'docs'));
  bad(f.finish(), /not a regular directory/);
  await fs.stat(f.answer); await fs.stat(f.html);
  assert.deepEqual(await fs.readdir(elsewhere), []);
});

test('transcripts with Markdown-looking answers build in the existing wiki reader', async t => {
  const f = await fixture(t);
  f.payload.answers[0].notes = '```\n[missing](../../outside.md)\n</script>\n````\nA & B';
  await f.write(); ok(f.collect());
  const {record} = ok(f.finish());
  const wiki = path.join(f.project, 'docs/wiki');
  const builder = path.join(wiki, '_build.mjs');
  await fs.copyFile(fileURLToPath(new URL('../skills/wiki/assets/_build.mjs', import.meta.url)), builder);
  await fs.writeFile(path.join(wiki, 'index.md'), `# Project\n\n[Answers](journal/${path.basename(record)})\n`);
  for (const args of [[], ['--check']]) {
    const r = spawnSync(process.execPath, [builder, ...args], {encoding: 'utf8'});
    assert.equal(r.status, 0, r.stderr);
  }
});

test('create refuses the plugin as the target and invalid input returns structured recovery guidance', () => {
  const plugin = fileURLToPath(new URL('..', import.meta.url));
  const r = run(['create', '--project', plugin], spec);
  bad(r, /target project/);
  const error = JSON.parse(r.stderr);
  assert.equal(error.status, 'error'); assert.match(error.help, /references\/usage.md$/);
  assert.throws(() => normalizeSpec({title: 'x', questions: [{prompt: 'x', recommendation: 'x', options: ['Same', ' same ']}]}), /Duplicate option label/);
});

test('rich descriptions preserve whitespace, embed offline renderers, and survive collection and cleanup', async t => {
  const input = structuredClone(spec);
  const source = '    indented code\r\n\r\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```mermaid\nflowchart LR\n A --> B\n```\n\n' + 'Detail '.repeat(600) + '\n';
  input.questions[0].context = source;
  const f = await fixture(t, input);
  assert.equal(f.state.spec.questions[0].context, source);
  assert.equal(f.state.richText, true);
  const html = await fs.readFile(f.html, 'utf8');
  assert.ok(Buffer.byteLength(html) > 600_000, 'diagram runtime should be embedded');
  assert.doesNotMatch(html, /<script[^>]+src=|__GRILL_FORM_RENDERERS__/);
  assert.match(html, /connect-src 'none'/);
  await f.write(); ok(f.collect());
  const {record} = ok(f.finish());
  const saved = await fs.readFile(record, 'utf8');
  assert.ok(saved.includes('Description (Markdown source):\n' + source));
  assert.match(saved, /````text/);
  await assert.rejects(fs.stat(f.session), {code: 'ENOENT'});
  const wiki = path.dirname(path.dirname(record)), builder = path.join(wiki, '_build.mjs');
  await fs.copyFile(fileURLToPath(new URL('../skills/wiki/assets/_build.mjs', import.meta.url)), builder);
  await fs.writeFile(path.join(wiki, 'index.md'), `# Project\n\n[Answers](journal/${path.basename(record)})\n`);
  for (const args of [[], ['--check']]) {
    const result = spawnSync(process.execPath, [builder, ...args], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
  }
  assert.throws(() => normalizeSpec({...input, questions: [{...input.questions[0], context: 'x'.repeat(12001)}]}, {richText: true}), /Invalid context/);
});

test('pre-rich sessions still collect with their old digest and retain the old transcript format', async t => {
  const input = structuredClone(spec); input.questions[0].context = '  Plain context  ';
  const f = await fixture(t, input);
  const legacy = {...f.state, spec: normalizeSpec(input)};
  delete legacy.richText; delete legacy.review;
  legacy.specDigest = createHash('sha256').update(JSON.stringify(legacy.spec)).digest('hex');
  await fs.writeFile(path.join(f.session, 'session.json'), JSON.stringify(legacy));
  await f.write({...f.payload, specDigest: legacy.specDigest});
  ok(f.collect());
  const {record} = ok(f.finish());
  const saved = await fs.readFile(record, 'utf8');
  assert.match(saved, /Context: Plain context\n/);
  assert.doesNotMatch(saved, /Description \(Markdown source\)/);
});

test('reviews accept partial feedback, enforce requirements, and validate regions, legacy anchors and state', () => {
  const review = normalizeSpec({title:'Open critique',questions:[
    {id:'design',preview:{html:'<button data-grill-anchor="Heading">Work</button>',anchors:['Heading'],state:{size:16}}},
    {id:'followup',prompt:'Anything else?'}
  ]},{richText:true,review:true});
  const state={review:true,spec:review,sessionId:'s',specDigest:'d'};
  const payload={schemaVersion:1,sessionId:'s',specDigest:'d',answers:[
    {questionId:'design',choiceId:null,notes:''},{questionId:'followup',choiceId:null,notes:''}
  ]};
  assert.throws(()=>validateSubmission(state,payload),/some feedback/);
  payload.answers[0].notes='Make it larger.';
  assert.deepEqual(validateSubmission(state,payload).answers.map(a=>a.status),['feedback','untouched']);
  state.spec.questions[1].required=true;
  assert.throws(()=>validateSubmission(state,payload),/Missing answer/);
  state.spec.questions[1].required=false;
  payload.answers[0].notes='';
  payload.answers[0].states={main:{size:20}};
  assert.equal(validateSubmission(state,payload).answers[0].status,'feedback');
  payload.answers[0].states={unknown:{}};
  assert.throws(()=>validateSubmission(state,payload),/state target/);
  payload.answers[0].states={main:{huge:'x'.repeat(12000)}};
  assert.throws(()=>validateSubmission(state,payload),/12,000/);
  payload.answers[0].states={};
  payload.answers[0].comments=[{preview:'main',anchor:'Heading',state:{size:20},notes:'Like this [Image #1]',images:[{id:1,offset:10,dataUrl:png}]}];
  assert.equal(validateSubmission(state,payload).answers[0].comments[0].images[0].mimeType,'image/png');
  payload.answers[0].comments[0].anchor='Forged';
  assert.throws(()=>validateSubmission(state,payload),/comment region or anchor/);
  const region={x:30,y:40,width:100,height:50,viewportWidth:800,viewportHeight:280,scroll:[{path:[],x:0,y:100},{path:[1,0],x:20,y:0}]};
  delete payload.answers[0].comments[0].anchor;
  payload.answers[0].comments[0].region=region;
  assert.deepEqual(validateSubmission(state,payload).answers[0].comments[0].region,region);
  for(const invalid of [
    {...region,x:-1},{...region,width:900},{...region,height:Infinity},{...region,viewportHeight:2000},
    {...region,scroll:[{path:['body'],x:0,y:0}]},{...region,scroll:[{path:[],x:0,y:1e20}]},
    {...region,scroll:Array(65).fill({path:[],x:0,y:0})}
  ]){
    payload.answers[0].comments[0].region=invalid;
    assert.throws(()=>validateSubmission(state,payload),/comment region or anchor/);
  }
  assert.throws(()=>normalizeSpec({title:'x',questions:[{}]},{review:true}),/prompt, context, or preview/);
});

test('visual review archives preserve source, comments and state; changed archives block cleanup', async t => {
  const input={title:'Saved review',questions:[{id:'design',preview:{html:'<p>Design revision A</p>',anchors:['Heading'],state:{size:16}}}]};
  const f=await fixture(t,input);
  const payload={...f.payload,answers:[{questionId:'design',choiceId:null,notes:'',states:{main:{size:20}},comments:[{preview:'main',anchor:'Heading',state:{size:18},notes:'Like [Image #1]',images:[{id:1,offset:5,dataUrl:png}]}]}]};
  await f.write(payload);
  const collected=ok(f.collect());
  assert.equal(collected.answers[0].comments[0].images[0].dataUrl,undefined);
  const blocker=path.join(f.session,'keep');await fs.writeFile(blocker,'preserve');
  bad(f.finish(),/Unexpected files/);
  const attachments=path.join(f.project,'docs/wiki/attachments');
  const archive=path.join(attachments,(await fs.readdir(attachments)).find(n=>n.endsWith('-review.html')));
  const saved=await fs.readFile(archive,'utf8');
  const embedded=JSON.parse(saved.match(/id="grill-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(embedded.archived,true);
  assert.equal(embedded.spec.questions[0].preview.html,input.questions[0].preview.html);
  assert.equal(embedded.savedAnswers[0].states.main.size,20);
  assert.equal(embedded.savedAnswers[0].comments[0].state.size,18);
  await fs.writeFile(archive,saved+'edited');
  bad(f.finish(),/Saved review changed/);
  await fs.stat(f.answer);
  await fs.writeFile(archive,saved);await fs.unlink(blocker);
  const finished=ok(f.finish());
  assert.equal(finished.preview,archive);
  assert.equal(finished.images.length,1);
  assert.match(await fs.readFile(finished.record,'utf8'),/Saved visual review/);
  const wiki=path.join(f.project,'docs/wiki'),builder=path.join(wiki,'_build.mjs');
  await fs.copyFile(fileURLToPath(new URL('../skills/wiki/assets/_build.mjs',import.meta.url)),builder);
  await fs.writeFile(path.join(wiki,'index.md'),`# Project\n\n[Feedback](journal/${path.basename(finished.record)})\n`);
  for(const args of [[],['--check']]){
    const result=spawnSync(process.execPath,[builder,...args],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
  }
  await assert.rejects(fs.stat(f.session),{code:'ENOENT'});
});

test('offline previews isolate styles and scripts, capture free regions, and restore comments in context', {skip:!process.env.GRILL_FORM_BROWSER,timeout:60000}, async t => {
  const input={title:'Visual review',questions:[
    {id:'design',prompt:'Try this layout',preview:{height:220,state:{size:16},html:`
      <style>*{box-sizing:content-box}body{margin:18px;min-height:550px;background:rgb(240,245,250);color:rgb(11,22,33);--inside:blue}
      button{background:rgb(255,255,255);color:rgb(11,22,33);padding:8px}#title{font-size:20px}</style>
      <h2 id="title">Work</h2>
      <button id="grow">Larger</button><output id="size"></output><img alt="Sample" src="${png}">
      <div id="scroll" style="height:60px;overflow:auto"><div style="height:300px">Scrollable content</div></div>
      <script>
      const draw=()=>document.querySelector('#size').textContent=grill.state.size;
      draw();document.querySelector('#grow').onclick=()=>{grill.setState({size:grill.state.size+2});draw()};
      try{parent.document.body.style.background='red';window.parentAccess=true}catch{window.parentAccess=false}
      </script>`}},
    {id:'choice',prompt:'Which symbol?',options:[
      {id:'dots',label:'Three dots',preview:{height:80,html:'<style>body{color:rgb(50,60,70);background:white}</style><svg viewBox="0 0 100 25" width="100"><circle cx="20" cy="12" r="3"/><circle cx="50" cy="12" r="3"/><circle cx="80" cy="12" r="3"/></svg>'}},
      {id:'hourglass',label:'Hourglass'}
    ]},
    {id:'open',prompt:'Anything else?'}
  ]};
  const f=await fixture(t,input),browser=await chrome(t);
  await browser.command('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:f.downloadDir});
  await browser.command('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await browser.command('Page.navigate',{url:f.url});
  await browser.evaluate(`new Promise(resolve=>{const check=()=>document.querySelectorAll('iframe').length===2?resolve():setTimeout(check,20);check()})`);
  // Attach through DevTools to the real cross-origin frames, retaining sandbox/site isolation.
  let frames=[];
  for(let i=0;i<30;i++){frames=await browser.frames();if(frames.length===2)break;await new Promise(r=>setTimeout(r,50))}
  assert.equal(frames.length,2);
  let prototype;
  for(const frame of frames)if(await frame.evaluate(`!!document.querySelector('#grow')`))prototype=frame;
  assert.ok(prototype);
  assert.equal(await prototype.evaluate(`window.parentAccess`),false);
  assert.equal(await browser.evaluate(`document.querySelector('iframe').contentDocument===null`),true);
  assert.equal(await browser.evaluate(`getComputedStyle(document.body).backgroundColor`),'rgb(24, 24, 27)');
  await browser.evaluate(`document.head.append(Object.assign(document.createElement('style'),{textContent:':root{--outside:red}*{outline-color:rgb(200,10,10)}body{color:rgb(200,10,10)}button{background:rgb(200,10,10)}'}))`);
  const isolated=await prototype.evaluate(`({bg:getComputedStyle(document.querySelector('button')).backgroundColor,color:getComputedStyle(document.body).color,outside:getComputedStyle(document.body).getPropertyValue('--outside'),box:getComputedStyle(document.body).boxSizing})`);
  assert.deepEqual(isolated,{bg:'rgb(255, 255, 255)',color:'rgb(11, 22, 33)',outside:'',box:'content-box'});
  assert.equal(await browser.evaluate(`getComputedStyle(document.body).getPropertyValue('--inside')`),'');
  assert.equal(await browser.evaluate(`getComputedStyle(document.body).boxSizing`),'border-box');
  // External styles and network APIs are denied by the child CSP even when the browser is online.
  await prototype.command('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  const blocked=await prototype.evaluate(`(async()=>{const violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.effectiveDirective));const link=document.createElement('link');link.rel='stylesheet';link.href='https://example.invalid/leak.css';document.head.append(link);let denied=false;try{await fetch('https://example.invalid/data')}catch{denied=true}await new Promise(r=>setTimeout(r,50));return {denied,violations}})()`);
  assert.equal(blocked.denied,true);assert.ok(blocked.violations.includes('style-src-elem'));
  assert.equal(await browser.evaluate(`document.querySelector('#submit').disabled`),true);
  await prototype.evaluate(`document.querySelector('#grow').click();document.querySelector('#title').click();document.querySelector('#scroll').scrollTop=110;window.scrollTo(0,40)`);
  assert.equal(await browser.evaluate(`document.querySelectorAll('.comment-dialog').length`),0,'ordinary prototype clicks do not create comments');
  const openComment=async()=>{
    await browser.evaluate(`document.querySelector('.comment-toggle').click()`);
    const bounds=await browser.evaluate(`(()=>{const r=document.querySelector('.comment-surface').getBoundingClientRect();return {x:r.x,y:r.y}})()`);
    await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',x:bounds.x+170,y:bounds.y+100,button:'left',clickCount:1});
    await browser.command('Input.dispatchMouseEvent',{type:'mouseMoved',x:bounds.x+20,y:bounds.y+50,button:'left',buttons:1});
    await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',x:bounds.x+20,y:bounds.y+50,button:'left',clickCount:1});
    await browser.evaluate(`new Promise(r=>setTimeout(r,100))`);
    assert.equal(await browser.evaluate(`!!document.querySelector('.comment-dialog')`),true,JSON.stringify(await browser.evaluate(`({hint:document.querySelector('.comment-hint').textContent,hidden:document.querySelector('.comment-surface').hidden,rect:document.querySelector('.comment-region').style.cssText,comments:answers[0].comments})`)));
  };
  await openComment();
  assert.equal(await browser.evaluate(`document.querySelector('.save-comment').disabled`),true);
  await browser.evaluate(`document.querySelector('.comment-dialog .comment-actions .quiet').click()`);
  await browser.evaluate(`new Promise(resolve=>{const check=()=>!document.querySelector('.comment-dialog')?resolve():setTimeout(check,20);check()})`);
  assert.equal(await browser.evaluate(`answers[0].comments.length`),0,'cancelling a blank comment leaves no empty fields');
  await openComment();
  await browser.evaluate(`const note=document.querySelector('.comment-dialog .notes-editor');note.textContent='Keep the larger heading';note.dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await browser.evaluate(`document.querySelector('#submit').disabled`),false);
  assert.equal(await browser.evaluate(`answers[0].comments[0].state.size`),18);
  const region=await browser.evaluate(`answers[0].comments[0].region`);
  assert.deepEqual([region.x,region.y,region.width,region.height],[20,50,150,50],'selection crosses arbitrary elements and supports reverse dragging');
  assert.deepEqual(region.scroll.map(s=>s.y),[40,110],'document and nested scroll offsets accompany the region');
  // Messages from any other window cannot forge prototype adjustments.
  await browser.evaluate(`window.dispatchEvent(new MessageEvent('message',{data:{grill:'forged',type:'state',value:{size:999}},source:window}))`);
  assert.equal(await browser.evaluate(`answers[0].states.main.size`),18);
  await browser.evaluate(`(()=>{
    const editor=document.querySelector('.comment-dialog .notes-editor');editor.focus();
    const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);
    getSelection().removeAllRanges();getSelection().addRange(range);
    const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
    const data=new DataTransfer();data.items.add(new File([Uint8Array.from(atob(canvas.toDataURL().split(',')[1]),c=>c.charCodeAt(0))],'comment.png',{type:'image/png'}));
    editor.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  })()`);
  await browser.evaluate(`new Promise(resolve=>{const check=()=>answers[0].comments[0].images?.[0]?.dataUrl?resolve():setTimeout(check,20);check()})`);
  await browser.evaluate(`document.querySelector('.save-comment').click()`);
  await browser.evaluate(`new Promise(resolve=>{const check=()=>document.querySelector('.comment-summary')?resolve():setTimeout(check,20);check()})`);
  assert.equal(await browser.evaluate(`document.querySelectorAll('.comment-summary .notes-editor').length`),0,'saved comments are compact text, not more input boxes');
  await browser.evaluate(`document.querySelector('.comment-summary .quiet').click();document.querySelector('.comment-dialog .notes-editor').textContent='Cancelled edit';document.querySelector('.comment-dialog .notes-editor').dispatchEvent(new Event('input',{bubbles:true}));document.querySelectorAll('.comment-actions .quiet')[1].click()`);
  await browser.evaluate(`new Promise(resolve=>{const check=()=>!document.querySelector('.comment-dialog')?resolve():setTimeout(check,20);check()})`);
  assert.equal(await browser.evaluate(`answers[0].comments[0].notes`),'Keep the larger heading[Image #1]');
  await prototype.evaluate(`document.querySelector('#grow').click()`);
  await browser.command('Page.reload');
  await browser.evaluate(`new Promise(resolve=>{const check=()=>document.querySelector('.comment-summary')?resolve():setTimeout(check,20);check()})`);
  assert.equal(await browser.evaluate(`document.querySelector('.comment-body').textContent`),'Keep the larger heading[Image #1]');
  assert.equal(await browser.evaluate(`answers[0].states.main.size`),20);
  if(process.env.GRILL_FORM_SCREENSHOT){const {data}=await browser.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(process.env.GRILL_FORM_SCREENSHOT+'.review.png',Buffer.from(data,'base64'))}
  await browser.command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await browser.evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
  if(process.env.GRILL_FORM_SCREENSHOT){const {data}=await browser.command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await fs.writeFile(process.env.GRILL_FORM_SCREENSHOT+'.review-mobile.png',Buffer.from(data,'base64'))}
  await browser.evaluate(`document.querySelector('#submit').click()`);
  await browser.evaluate(`new Promise(r=>setTimeout(r,200))`);
  const collected=ok(f.collect());
  assert.deepEqual(collected.answers.map(a=>a.status),['feedback','untouched','untouched']);
  assert.deepEqual(collected.answers[0].comments[0].region,region);
  assert.equal(collected.answers[0].comments[0].images.length,1);
  const finished=ok(f.finish());
  await browser.command('Page.navigate',{url:new URL('file://'+finished.preview).href});
  await browser.evaluate(`new Promise(resolve=>{const check=()=>document.querySelector('.comment-summary')?resolve():setTimeout(check,20);check()})`);
  assert.equal(await browser.evaluate(`document.querySelector('#actions').hidden`),true);
  assert.equal(await browser.evaluate(`document.querySelector('.comment-summary button').textContent`),'View area');
  assert.equal(await browser.evaluate(`document.querySelector('.comment-summary .image-chip').textContent`),'[Image #1]');
  assert.equal(await browser.evaluate(`answers[0].states.main.size`),20);
  const savedFrames=await browser.frames();
  let restored=false;for(const frame of savedFrames)if(await frame.evaluate(`document.querySelector('#size')?.textContent==='20'`))restored=true;
  assert.equal(restored,true,'saved prototype restores the submitted state in its own document');
  await browser.evaluate(`document.querySelector('.comment-summary button').click()`);
  let selectedView;
  for(let i=0;i<30&&!selectedView;i++){
    for(const frame of await browser.frames())if(await frame.evaluate(`document.querySelector('#size')?.textContent==='18'`))selectedView=frame;
    if(!selectedView)await new Promise(r=>setTimeout(r,50));
  }
  assert.ok(selectedView);
  await selectedView.evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  assert.deepEqual(await selectedView.evaluate(`({width:innerWidth,height:innerHeight,scroll:scrollY,nested:document.querySelector('#scroll').scrollTop})`),{width:region.viewportWidth,height:region.viewportHeight,scroll:40,nested:110},'archived area replays its original viewport, state and scrolling even on a smaller screen');
  assert.equal(await browser.evaluate(`document.querySelector('.comment-dialog .notes-editor')===null`),true);
  assert.equal(await browser.evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
  assert.deepEqual(browser.events.filter(e=>e.method==='Runtime.exceptionThrown'),[]);
});

test('region comments support touch, keyboard, cancellation, deletion and dragging past the preview edge', {skip:!process.env.GRILL_FORM_BROWSER,timeout:30000}, async t=>{
  const f=await fixture(t,{title:'Areas',questions:[{id:'design',preview:{height:240,html:'<style>body{margin:20px;font:16px system-ui}</style><h2>Any part of this design</h2><p>No predefined targets.</p>'}}]});
  const browser=await chrome(t);
  await browser.command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await browser.command('Emulation.setTouchEmulationEnabled',{enabled:true});
  await browser.command('Page.navigate',{url:f.url});
  await browser.evaluate(`new Promise(resolve=>{const check=()=>document.querySelector('.comment-toggle')?resolve():setTimeout(check,20);check()})`);
  const waitDialog=()=>browser.evaluate(`new Promise(resolve=>{const check=()=>document.querySelector('.comment-dialog')?resolve():setTimeout(check,20);check()})`);
  const waitClosed=()=>browser.evaluate(`new Promise(resolve=>{const check=()=>!document.querySelector('.comment-dialog')?resolve():setTimeout(check,20);check()})`);
  const start=async()=>{
    await browser.evaluate(`document.querySelector('.comment-toggle').click()`);
    return browser.evaluate(`(()=>{const r=document.querySelector('.comment-surface').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`);
  };
  let b=await start();
  await browser.command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+40,y:b.y+40,id:0}]});
  await browser.command('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+230,y:b.y+160,id:0}]});
  await browser.command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await waitDialog();
  const touch=await browser.evaluate(`answers[0].comments[0].region`);
  assert.deepEqual([touch.x,touch.y,touch.width,touch.height],[40,40,190,120]);
  await browser.evaluate(`const note=document.querySelector('.comment-dialog .notes-editor');note.textContent='More spacing here';note.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.save-comment').click()`);
  await waitClosed();
  await browser.evaluate(`document.querySelector('.comment-summary button').click();document.querySelector('.comment-actions button').click()`);
  await waitClosed();
  assert.equal(await browser.evaluate(`answers[0].comments.length`),0);
  assert.equal(await browser.evaluate(`document.querySelector('#submit').disabled`),true);
  await start();
  await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight'});
  await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape'});
  assert.equal(await browser.evaluate(`document.querySelector('.comment-surface').hidden`),true,'Escape cancels the selection');
  assert.equal(await browser.evaluate(`answers[0].comments.length`),0);
  await start();
  await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight'});
  await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',modifiers:8});
  await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter'});
  await waitDialog();
  const keyboard=await browser.evaluate(`answers[0].comments[0].region`);
  assert.deepEqual([keyboard.x,keyboard.y,keyboard.width,keyboard.height],[28,20,120,88]);
  await browser.evaluate(`document.querySelector('.comment-actions .quiet').click()`);
  await waitClosed();
  await browser.command('Emulation.setTouchEmulationEnabled',{enabled:false});
  b=await start();
  await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',x:b.x+40,y:b.y+40,button:'left',clickCount:1});
  await browser.command('Input.dispatchMouseEvent',{type:'mouseMoved',x:b.x+b.width+30,y:b.y+b.height+50,button:'left',buttons:1});
  await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',x:b.x+b.width+30,y:b.y+b.height+50,button:'left',clickCount:1});
  await waitDialog();
  const edge=await browser.evaluate(`answers[0].comments[0].region`);
  assert.equal(edge.x+edge.width,edge.viewportWidth);assert.equal(edge.y+edge.height,edge.viewportHeight);
  assert.equal(await browser.evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
  assert.deepEqual(browser.events.filter(e=>e.method==='Runtime.exceptionThrown'),[]);
});

test('choice previews omit comment actions and entire cards select across iframe content and controls', {skip:!process.env.GRILL_FORM_BROWSER,timeout:30000}, async t=>{
  const input={title:'Visual card selection',questions:[{id:'symbols',prompt:'Choose a design',preview:{height:64,html:'<p>Compare the two designs below.</p>'},options:[
    {id:'a',label:'Interactive preview',preview:{height:150,state:{count:0},html:`<style>body{margin:0;padding:20px;background:#24252b;color:#eee;font:14px system-ui}button{padding:12px}</style><button id="counter">Adjust</button><script>document.querySelector('button').onclick=e=>{e.stopImmediatePropagation();grill.setState({count:grill.state.count+1})}</script>`}},
    {id:'b',label:'SVG preview',preview:{height:150,html:`<style>body{margin:0;padding:20px;background:#24252b;color:#eee;font:14px system-ui}svg{display:block}</style><svg id="symbol" width="80" height="80" viewBox="0 0 24 24"><circle fill="#b7a6ff" cx="12" cy="12" r="6"/></svg>`}}
  ]}]};
  const f=await fixture(t,input),browser=await chrome(t);
  await browser.command('Emulation.setDeviceMetricsOverride',{width:1100,height:800,deviceScaleFactor:1,mobile:false});
  await browser.command('Page.navigate',{url:f.url});
  await browser.evaluate(`new Promise(resolve=>{const check=()=>document.querySelectorAll('iframe').length===3?resolve():setTimeout(check,20);check()})`);
  assert.equal(await browser.evaluate(`document.querySelectorAll('.comment-toggle,.preview-toolbar').length`),0,'neither the question preview nor its options need comment actions');
  assert.equal(await browser.evaluate(`document.querySelectorAll('fieldset .notes-editor').length`),1,'choices share one notes field');
  let frames=[];
  for(let i=0;i<30;i++){frames=await browser.frames();if(frames.length===3)break;await new Promise(r=>setTimeout(r,50))}
  assert.equal(frames.length,3);
  let interactive,visual;
  for(const frame of frames){if(await frame.evaluate(`!!document.querySelector('#counter')`))interactive=frame;else if(await frame.evaluate(`!!document.querySelector('#symbol')`))visual=frame}
  await visual.evaluate(`document.querySelector('circle').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await browser.evaluate(`new Promise(resolve=>{const check=()=>answers[0].choiceId==='b'?resolve():setTimeout(check,20);check()})`);
  await interactive.evaluate(`document.querySelector('#counter').click()`);
  await browser.evaluate(`new Promise(resolve=>{const check=()=>answers[0].choiceId==='a'&&answers[0].states?.['option-a']?.count===1?resolve():setTimeout(check,20);check()})`);
  assert.equal(await interactive.evaluate(`grill.state.count`),1,'selecting the option preserves its own interactive action');
  await visual.evaluate(`document.body.click()`);
  await browser.evaluate(`new Promise(resolve=>{const check=()=>answers[0].choiceId==='b'?resolve():setTimeout(check,20);check()})`);
  await browser.evaluate(`document.querySelector('.choice-card').click()`);
  assert.equal(await browser.evaluate(`answers[0].choiceId`),'a');
  await browser.evaluate(`new Promise(resolve=>setTimeout(resolve,160))`);
  const borders=await browser.evaluate(`(()=>{const card=document.querySelector('.choice-card'),label=card.querySelector('.choice');const outer=getComputedStyle(card),inner=getComputedStyle(label);return {top:outer.borderTopWidth,bottom:outer.borderBottomWidth,left:outer.borderLeftWidth,color:outer.borderTopColor,outline:outer.outlineStyle,innerBorder:inner.borderTopWidth,innerOutline:inner.outlineStyle}})()`);
  assert.deepEqual(borders,{top:'2px',bottom:'2px',left:'2px',color:'rgb(183, 166, 255)',outline:'none',innerBorder:'0px',innerOutline:'none'});
  if(process.env.GRILL_FORM_SCREENSHOT){const {data}=await browser.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(process.env.GRILL_FORM_SCREENSHOT+'.cards.png',Buffer.from(data,'base64'))}
  await browser.command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await browser.evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
  assert.deepEqual(browser.events.filter(e=>e.method==='Runtime.exceptionThrown'),[]);
});

test('offline notes paste inline chips, delete and undo atomically, preview, reload, and export images', {skip: !process.env.GRILL_FORM_BROWSER, timeout: 60000}, async t => {
  const input = {title: 'Inline image references', questions: [{prompt: 'Which details should we keep?', recommendation: 'Point to each detail where you describe it.', options: ['Keep this direction', 'Try another direction']}]};
  const f = await fixture(t, input), browser = await chrome(t);
  await browser.command('Browser.setDownloadBehavior', {behavior: 'allow', downloadPath: f.downloadDir});
  await browser.command('Emulation.setDeviceMetricsOverride', {width: 1100, height: 850, deviceScaleFactor: 1, mobile: false});
  await browser.command('Page.navigate', {url: f.url});
  await browser.evaluate(`new Promise(resolve=>{const ready=()=>document.querySelector('.notes-editor')?resolve(true):setTimeout(ready,20);ready()})`);
  await browser.evaluate(`
    globalThis.editor=document.querySelector('.notes-editor');
    globalThis.caret=(node,offset)=>{editor.focus();const range=document.createRange();range.setStart(node,offset);range.collapse(true);getSelection().removeAllRanges();getSelection().addRange(range)};
    globalThis.pasteImages=(count=1)=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const context=canvas.getContext('2d');context.fillStyle='#233943';context.fillRect(0,0,320,180);context.fillStyle='#8bddf2';context.font='22px sans-serif';context.fillText('Reference image',62,98);const bytes=Uint8Array.from(atob(canvas.toDataURL().split(',')[1]),c=>c.charCodeAt(0));const data=new DataTransfer();for(let i=0;i<count;i++)data.items.add(new File([bytes],'clipboard.png',{type:'image/png'}));editor.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}))};
    editor.textContent='Use this spacing  and this color.';editor.dispatchEvent(new Event('input',{bubbles:true}));caret(editor.firstChild,17);pasteImages();
    // Move and type before FileReader completes: the image must stay at the paste point.
    caret(editor,editor.childNodes.length);document.execCommand('insertText',false,' Keep the label.');
  `);
  await browser.evaluate(`new Promise(resolve=>{const ready=()=>!document.querySelector('#submit').disabled?resolve(true):setTimeout(ready,20);ready()})`);
  assert.equal(await browser.evaluate(`editor.querySelectorAll('.image-chip').length`), 1);
  assert.equal(await browser.evaluate(`editor.textContent`), 'Use this spacing [Image #1] and this color. Keep the label.');
  await browser.evaluate(`editor.querySelector('.image-chip').click()`);
  assert.equal(await browser.evaluate(`document.querySelector('dialog').open`), true);
  await browser.evaluate(`new Promise(resolve=>{const img=document.querySelector('dialog img');if(img.complete)resolve(true);else img.onload=()=>resolve(true)})`);
  assert.equal(await browser.evaluate(`document.querySelector('dialog img').naturalWidth`), 320);
  await browser.command('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
  await browser.command('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
  assert.equal(await browser.evaluate(`document.querySelector('dialog').open`), false);
  const key = async (name, code) => {
    await browser.command('Input.dispatchKeyEvent', {type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: code});
    await browser.command('Input.dispatchKeyEvent', {type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code});
  };
  await browser.evaluate(`const chip=editor.querySelector('.image-chip');caret(editor,[...editor.childNodes].indexOf(chip)+1)`);
  await key('Backspace', 8);
  assert.equal(await browser.evaluate(`editor.textContent`), 'Use this spacing  and this color. Keep the label.');
  await browser.evaluate(`document.execCommand('undo')`);
  assert.equal(await browser.evaluate(`editor.querySelectorAll('.image-chip').length`), 1);
  await browser.evaluate(`caret(editor,[...editor.childNodes].indexOf(editor.querySelector('.image-chip')))`);
  await key('Delete', 46);
  assert.equal(await browser.evaluate(`editor.querySelectorAll('.image-chip').length`), 0);
  await browser.evaluate(`document.execCommand('undo')`);
  assert.equal(await browser.evaluate(`editor.querySelectorAll('.image-chip').length`), 1);
  await browser.evaluate(`caret(editor,editor.childNodes.length);document.execCommand('insertText',false,'\\nCompare ')`);
  await browser.evaluate(`pasteImages(2)`);
  await browser.evaluate(`new Promise(resolve=>{const ready=()=>!document.querySelector('#submit').disabled?resolve(true):setTimeout(ready,20);ready()})`);
  assert.deepEqual(await browser.evaluate(`[...editor.querySelectorAll('.image-chip')].map(chip=>chip.textContent)`), ['[Image #1]', '[Image #2]', '[Image #3]']);
  await browser.command('Input.insertText', {text: ' for contrast.'});
  assert.equal(await browser.evaluate(`editor.querySelectorAll('.image-chip').length`), 3);
  assert.ok(await browser.evaluate(`editor.textContent.endsWith(' for contrast.')`));
  // A selection can include ordinary text and whole chips.
  await browser.evaluate(`editor.focus();const range=document.createRange();range.setStartBefore(editor.querySelectorAll('.image-chip')[1]);range.setEndAfter(editor.querySelectorAll('.image-chip')[2]);getSelection().removeAllRanges();getSelection().addRange(range)`);
  await key('Backspace', 8);
  assert.equal(await browser.evaluate(`editor.querySelectorAll('.image-chip').length`), 1);
  await browser.evaluate(`document.execCommand('undo')`);
  assert.equal(await browser.evaluate(`editor.querySelectorAll('.image-chip').length`), 3);
  await browser.evaluate(`editor.querySelectorAll('.image-chip')[1].focus()`);
  await key('Backspace', 8);
  assert.deepEqual(await browser.evaluate(`[...editor.querySelectorAll('.image-chip')].map(chip=>chip.textContent)`), ['[Image #1]', '[Image #3]']);
  await browser.command('Page.reload');
  await browser.evaluate(`new Promise(resolve=>{const ready=()=>document.querySelectorAll('.image-chip').length===2?resolve(true):setTimeout(ready,20);ready()})`);
  assert.deepEqual(await browser.evaluate(`[...document.querySelectorAll('.image-chip')].map(chip=>chip.textContent)`), ['[Image #1]', '[Image #3]']);
  if (process.env.GRILL_FORM_SCREENSHOT) {
    const {data} = await browser.command('Page.captureScreenshot', {format: 'png'});
    await fs.writeFile(process.env.GRILL_FORM_SCREENSHOT + '.images.png', Buffer.from(data, 'base64'));
  }
  await browser.command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  assert.ok(await browser.evaluate(`document.documentElement.scrollWidth<=innerWidth`));
  if (process.env.GRILL_FORM_SCREENSHOT) {
    const {data} = await browser.command('Page.captureScreenshot', {format: 'png'});
    await fs.writeFile(process.env.GRILL_FORM_SCREENSHOT + '.images-mobile.png', Buffer.from(data, 'base64'));
  }
  await browser.evaluate(`document.querySelector('#submit').click()`);
  await browser.evaluate(`new Promise(resolve=>setTimeout(resolve,200))`);
  const payload = JSON.parse(await fs.readFile(f.answer, 'utf8'));
  const answer = payload.answers[0];
  assert.deepEqual(answer.images.map(image=>image.id), [1, 3]);
  for (const image of answer.images) assert.equal(answer.notes.slice(image.offset, image.offset + `[Image #${image.id}]`.length), `[Image #${image.id}]`);
  assert.equal(answer.notes, 'Use this spacing [Image #1] and this color. Keep the label.\nCompare [Image #3] for contrast.');
  const received = ok(f.collect()); assert.equal(received.answers[0].images.length, 2);
  assert.equal(ok(f.finish()).images.length, 2);
  assert.deepEqual(browser.events.filter(e=>e.method==='Runtime.exceptionThrown'), []);
  assert.deepEqual(browser.events.filter(e=>e.method==='Network.requestWillBeSent' && /^https?:/.test(e.params.request.url)), []);
});

test('offline notes preserve copied chips and handle invalid images, text paste, and draft storage failure', {skip: !process.env.GRILL_FORM_BROWSER, timeout: 30000}, async t => {
  const f = await fixture(t), browser = await chrome(t);
  await browser.command('Browser.setDownloadBehavior', {behavior: 'allow', downloadPath: f.downloadDir});
  await browser.command('Page.navigate', {url: f.url});
  await browser.evaluate(`new Promise(resolve=>{const ready=()=>document.querySelector('.notes-editor')?resolve(true):setTimeout(ready,20);ready()})`);
  await browser.evaluate(`
    globalThis.editors=[...document.querySelectorAll('.notes-editor')];
    globalThis.end=editor=>{editor.focus();const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);getSelection().removeAllRanges();getSelection().addRange(range)};
    globalThis.selectChip=editor=>{editor.focus();const range=document.createRange();range.selectNode(editor.querySelector('.image-chip'));getSelection().removeAllRanges();getSelection().addRange(range)};
    globalThis.pasteFile=(type,bytes)=>{const data=new DataTransfer();data.items.add(new File([bytes],'clipboard',{type}));editors[0].dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}))};
    editors[0].textContent='Look ';editors[0].dispatchEvent(new Event('input'));editors[1].textContent='Compare ';editors[1].dispatchEvent(new Event('input'));end(editors[0]);
    pasteFile('image/svg+xml','<svg/>');
  `);
  assert.equal(await browser.evaluate(`document.querySelectorAll('.image-chip').length`), 0);
  assert.match(await browser.evaluate(`document.querySelector('#notes-audience-error').textContent`), /PNG, JPEG/);
  await browser.evaluate(`pasteFile('image/png',new Uint8Array(5*1024*1024+1))`);
  assert.match(await browser.evaluate(`document.querySelector('#notes-audience-error').textContent`), /5 MiB/);
  await browser.evaluate(`pasteFile('image/png','not an image')`);
  await browser.evaluate(`new Promise(resolve=>{const ready=()=>document.querySelector('#notes-audience-error').textContent.includes('could not be read')?resolve(true):setTimeout(ready,20);ready()})`);
  assert.equal(await browser.evaluate(`document.querySelector('#submit').disabled`), true);
  await browser.evaluate(`selectChip(editors[0]);document.execCommand('delete');end(editors[0]);const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;pasteFile('image/png',Uint8Array.from(atob(canvas.toDataURL().split(',')[1]),c=>c.charCodeAt(0)))`);
  await browser.evaluate(`new Promise(resolve=>{const ready=()=>!document.querySelector('#submit').disabled?resolve(true):setTimeout(ready,20);ready()})`);
  const pastedId = await browser.evaluate(`editors[0].querySelector('.image-chip').dataset.imageId`);
  // Undo/redo the insertion itself, not only a later deletion.
  await browser.evaluate(`document.execCommand('undo')`);
  assert.equal(await browser.evaluate(`document.querySelectorAll('.image-chip').length`), 0);
  await browser.evaluate(`document.execCommand('redo')`);
  assert.equal(await browser.evaluate(`editors[0].querySelector('.image-chip').contentEditable`), 'false');
  await browser.evaluate(`selectChip(editors[0]);globalThis.copied=new DataTransfer();editors[0].dispatchEvent(new ClipboardEvent('copy',{clipboardData:copied,bubbles:true,cancelable:true}));end(editors[1]);editors[1].dispatchEvent(new ClipboardEvent('paste',{clipboardData:copied,bubbles:true,cancelable:true}))`);
  assert.equal(await browser.evaluate(`editors[1].querySelectorAll('.image-chip').length`), 1);
  assert.notEqual(await browser.evaluate(`editors[1].querySelector('.image-chip').dataset.imageId`), pastedId);
  await browser.evaluate(`selectChip(editors[0]);globalThis.cut=new DataTransfer();editors[0].dispatchEvent(new ClipboardEvent('cut',{clipboardData:cut,bubbles:true,cancelable:true}));end(editors[1]);editors[1].dispatchEvent(new ClipboardEvent('paste',{clipboardData:cut,bubbles:true,cancelable:true}))`);
  assert.equal(await browser.evaluate(`editors[0].querySelectorAll('.image-chip').length`), 0);
  assert.equal(await browser.evaluate(`editors[1].querySelectorAll('.image-chip').length`), 2);
  await browser.evaluate(`end(editors[0]);const data=new DataTransfer();data.setData('text/plain','<img src=x onerror=alert(1)>\\nLiteral [Image #99]');data.setData('text/html','<img src="https://example.invalid/image.png">');editors[0].dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}))`);
  assert.equal(await browser.evaluate(`editors[0].querySelectorAll('img,.image-chip').length`), 0);
  await browser.evaluate(`editors[0].textContent='x'.repeat(12001);editors[0].dispatchEvent(new Event('input'))`);
  assert.equal(await browser.evaluate(`document.querySelector('#submit').disabled`), true);
  await browser.evaluate(`Storage.prototype.setItem=()=>{throw new DOMException('full','QuotaExceededError')};editors[0].textContent='  Literal [Image #99]';editors[0].dispatchEvent(new Event('input'))`);
  assert.equal(await browser.evaluate(`document.querySelector('#draft-message').hidden`), false);
  assert.equal(await browser.evaluate(`document.querySelector('#submit').disabled`), false);
  await browser.evaluate(`document.querySelector('#submit').click();`);
  await browser.evaluate(`new Promise(resolve=>setTimeout(resolve,200))`);
  const received = ok(f.collect());
  assert.equal(received.answers[0].notes, 'Literal [Image #99]');
  assert.equal(received.answers[0].images, undefined);
  assert.equal(received.answers[1].images.length, 2);
  assert.equal(ok(f.finish()).images.length, 2);
  assert.deepEqual(browser.events.filter(e=>e.method==='Runtime.exceptionThrown'), []);
});

test('form keeps descriptions, notes, selection controls, and submission compact', {skip: !process.env.GRILL_FORM_BROWSER, timeout: 30000}, async t => {
  const input = {title: 'Project decisions', questions: [
    {prompt: 'Who edits the site?', context: 'Choose who can **edit and publish**.', recommendation: 'Start with one owner.', options: ['One owner', 'A team']},
    {prompt: 'What would you change?', context: 'Describe anything that feels unclear.\n\n```js\nreview();\n```'},
    {prompt: 'Does the schedule work?', context: '| Monday | Tuesday | Wednesday | Thursday | Friday |\n| --- | --- | --- | --- | --- |\n| Draft content | Review content | Make revisions | Final approval | Publish content |'},
    {prompt: 'Review the long example.', context: '```txt\n' + 'example-'.repeat(30) + '\n```'},
  ]};
  const f = await fixture(t, input), browser = await chrome(t);
  await browser.command('Browser.setDownloadBehavior', {behavior: 'allow', downloadPath: f.downloadDir});
  await browser.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false});
  await browser.command('Page.navigate', {url: f.url});
  await browser.evaluate(`new Promise(resolve=>{const ready=()=>document.querySelectorAll('.description').length===4?requestAnimationFrame(()=>requestAnimationFrame(resolve)):setTimeout(ready,20);ready()})`);
  const initial = await browser.evaluate(`({boxed:[...document.querySelectorAll('.description')].map(d=>d.classList.contains('has-expansion')),plainButton:!!document.querySelector('.description').querySelector('.expand'),clear:document.querySelector('.clear-selection').hidden,notes:[...document.querySelectorAll('fieldset>.notes-editor')].map(n=>n.getBoundingClientRect().height),submit:document.querySelectorAll('#actions button').length})`);
  assert.deepEqual(initial.boxed, [false, false, false, true], 'only overflowing content needs expansion');
  assert.equal(initial.plainButton, false);
  assert.equal(initial.clear, true);
  assert.ok(initial.notes[0] < 50 && initial.notes[1] >= 96, 'choice notes start small; open feedback remains roomy');
  assert.equal(initial.submit, 1);
  await browser.evaluate(`const notes=document.querySelector('.notes-editor');notes.focus();document.execCommand('insertText',false,'First thought\\nSecond thought\\nThird thought\\nFourth thought')`);
  assert.ok(await browser.evaluate(`document.querySelector('.notes-editor').getBoundingClientRect().height`) > initial.notes[0] * 2, 'notes grow with the content');
  await browser.evaluate(`document.querySelector('.notes-editor').textContent='Start small';document.querySelector('.notes-editor').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await browser.evaluate(`document.querySelector('.notes-editor').getBoundingClientRect().height`), initial.notes[0], 'notes shrink after editing');
  await browser.evaluate(`document.querySelector('input[type=radio]').click()`);
  assert.equal(await browser.evaluate(`document.querySelector('.clear-selection').hidden`), false);
  await browser.command('Page.reload');
  await browser.evaluate(`new Promise(resolve=>{const ready=()=>document.querySelector('input:checked')?resolve(true):setTimeout(ready,20);ready()})`);
  assert.equal(await browser.evaluate(`document.querySelector('.clear-selection').hidden`), false, 'restored choices can be cleared');
  await browser.evaluate(`document.querySelector('.clear-selection').click()`);
  assert.equal(await browser.evaluate(`document.querySelector('.clear-selection').hidden`), true);
  assert.equal(await browser.evaluate(`document.querySelectorAll('input:checked').length`), 0);
  assert.equal(await browser.evaluate(`document.querySelector('.notes-editor').textContent`), 'Start small');
  assert.equal(await browser.evaluate(`document.activeElement.type`), 'radio', 'clearing restores focus to the choice');
  if (process.env.GRILL_FORM_SCREENSHOT) {
    const {data} = await browser.command('Page.captureScreenshot', {format: 'png'});
    await fs.writeFile(process.env.GRILL_FORM_SCREENSHOT + '.simplified.png', Buffer.from(data, 'base64'));
  }
  await browser.command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  await browser.evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  assert.equal(await browser.evaluate(`document.querySelectorAll('.description')[2].querySelector('.description-toolbar').hidden`), false, 'a table that overflows on mobile gains an expand control');
  assert.ok(await browser.evaluate(`document.documentElement.scrollWidth<=innerWidth`));
  await browser.evaluate(`document.querySelector('input[type=radio]').click();document.querySelector('#submit').scrollIntoView()`);
  if (process.env.GRILL_FORM_SCREENSHOT) {
    const {data} = await browser.command('Page.captureScreenshot', {format: 'png'});
    await fs.writeFile(process.env.GRILL_FORM_SCREENSHOT + '.actions.png', Buffer.from(data, 'base64'));
  }
  await browser.evaluate(`globalThis.closeRequests=0;window.close=()=>closeRequests++;document.querySelector('#submit').click();new Promise(resolve=>setTimeout(resolve,200))`);
  assert.equal(await browser.evaluate(`globalThis.closeRequests`), 0);
  assert.equal(await browser.evaluate(`document.querySelector('#submit').textContent`), 'Download answers again');
  const received = ok(f.collect());
  assert.equal(received.status, 'received');
  assert.equal(received.answers[0].choice, 'One owner');
  assert.equal(received.answers[0].notes, 'Start small');
  assert.equal(ok(f.finish()).status, 'finished');
  assert.deepEqual(browser.events.filter(e=>e.method==='Runtime.exceptionThrown'), []);
});

test('offline browser renders rich content, handles diagram errors, expands, and exports collectible answers', {skip: !process.env.GRILL_FORM_BROWSER, timeout: 60000}, async t => {
  const input = {title: 'Rich form browser check', questions: [{
    id: 'rich', prompt: 'Which **workflow** should we use?', recommendation: 'Review first.', options: ['Review first', 'Publish directly'],
    context: 'A **review** step keeps changes visible.\n\n| Choice | Benefit |\n| --- | --- |\n| Review | Check before release |\n| Direct | Immediate updates |\n\n- First draft\n- Then review\n\n> Decide before publishing.\n\n```js\nconst example = "<tag>";\n```\n\n```mermaid\nflowchart LR\n Draft --> Review --> Approve --> Schedule --> Publish\n```\n\n```mermaid\nsequenceDiagram\n Editor->>Reviewer: Request review\n Reviewer-->>Editor: Approved\n```\n\n```mermaid\nstateDiagram-v2\n [*] --> Draft\n Draft --> Published\n```\n\n```mermaid\nflowchart LR\n broken [\n```\n\n```mermaid\npie\n "unsupported": 1\n```\n\n```mermaid\n%%{init: {"securityLevel": "loose"}}%%\nflowchart LR\n A-->B\n```\n\n<script>globalThis.__grillTestInjected = true</script>\n\n<img src="https://example.invalid/image" onerror="globalThis.__grillTestInjected=true">\n\n[Unsafe](javascript:alert(1)) [Reference](https://example.com) ![Image alt](https://example.invalid/image)'
  }]};
  const f = await fixture(t, input), browser = await chrome(t);
  await browser.command('Browser.setDownloadBehavior', {behavior: 'allow', downloadPath: f.downloadDir});
  await browser.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false});
  await browser.command('Page.navigate', {url: f.url});
  await browser.evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{const diagrams=[...document.querySelectorAll('.diagram')];if(diagrams.length===6&&diagrams.every(d=>d.dataset.renderState!=='pending'))resolve(true);else if(Date.now()-start>12000)reject(new Error('Diagram rendering timed out'));else setTimeout(poll,50)};poll()})`);
  const header = await browser.evaluate(`({project:document.querySelector('header h1').textContent,round:document.querySelector('header h2').textContent,title:document.title,above:document.querySelector('header h1').getBoundingClientRect().bottom<=document.querySelector('header h2').getBoundingClientRect().top,submitDisabled:document.querySelector('#submit').disabled})`);
  assert.equal(header.project, path.basename(f.project));
  assert.equal(header.round, input.title);
  assert.equal(header.title, path.basename(f.project) + ' — ' + input.title);
  assert.equal(header.above, true);
  assert.equal(header.submitDisabled, true);
  const rendered = await browser.evaluate(`({ready:document.querySelectorAll('.diagram[data-render-state=ready] svg').length,errors:document.querySelectorAll('.diagram-error').length,table:document.querySelectorAll('table tbody tr').length,bold:document.querySelector('strong')?.textContent,question:document.querySelector('legend').textContent,code:document.querySelector('code.language-js')?.textContent,injected:!!globalThis.__grillTestInjected,images:document.querySelectorAll('img').length,unsafeLinks:[...document.querySelectorAll('a[href]')].some(a=>!a.href.startsWith('https://')),fallbacks:[...document.querySelectorAll('.diagram[data-render-state=error] pre')].map(p=>p.textContent)})`);
  assert.equal(rendered.ready, 4, JSON.stringify(rendered)); assert.equal(rendered.errors, 2);
  assert.equal(rendered.table, 2); assert.equal(rendered.bold, 'review');
  assert.equal(rendered.question, '1. Which **workflow** should we use?');
  assert.match(rendered.code, /<tag>/); assert.equal(rendered.injected, false, JSON.stringify(rendered));
  assert.equal(rendered.images, 0); assert.equal(rendered.unsafeLinks, false);
  assert.ok(rendered.fallbacks.some(text => text.includes('broken [')));
  const control = await browser.evaluate(`(()=>{const button=document.querySelector('.expand'),box=document.querySelector('.description').getBoundingClientRect(),content=document.querySelector('.rich-content').getBoundingClientRect(),rect=button.getBoundingClientRect();return {label:button.getAttribute('aria-label'),text:button.textContent,icon:!!button.querySelector('svg'),below:rect.top>=content.bottom,right:box.right-rect.right,bottom:box.bottom-rect.bottom}})()`);
  assert.equal(control.label, 'Expand description'); assert.equal(control.text, ''); assert.equal(control.icon, true);
  assert.ok(control.below && control.right <= 16 && control.bottom <= 16, 'icon belongs in the bottom-right corner');
  const expansion = await browser.evaluate(`(()=>{const description=document.querySelector('.description');const before=description.getBoundingClientRect().width;document.querySelector('.expand').click();return {before,after:description.getBoundingClientRect().width,expanded:document.querySelector('.expand').getAttribute('aria-expanded')}})()`);
  assert.ok(expansion.after > expansion.before); assert.equal(expansion.expanded, 'true');
  assert.equal(await browser.evaluate(`document.querySelector('.expand').getAttribute('aria-label')`), 'Collapse description');
  if (process.env.GRILL_FORM_SCREENSHOT) {
    const {data} = await browser.command('Page.captureScreenshot', {format: 'png'});
    await fs.writeFile(process.env.GRILL_FORM_SCREENSHOT, Buffer.from(data, 'base64'));
  }
  await browser.evaluate(`document.querySelector('.description').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  assert.equal(await browser.evaluate(`document.querySelector('.expand').getAttribute('aria-expanded')`), 'false');
  await browser.command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  assert.ok(await browser.evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'mobile page must not overflow horizontally');
  await browser.evaluate(`document.querySelector('.expand').click()`);
  assert.ok(await browser.evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'expanded content must fit on mobile');
  assert.ok(await browser.evaluate(`document.querySelector('.diagram').scrollWidth > document.querySelector('.diagram').clientWidth`), 'expanded diagrams retain readable size and scroll on narrow screens');
  if (process.env.GRILL_FORM_SCREENSHOT) {
    const {data} = await browser.command('Page.captureScreenshot', {format: 'png'});
    await fs.writeFile(process.env.GRILL_FORM_SCREENSHOT + '.mobile.png', Buffer.from(data, 'base64'));
  }
  await browser.evaluate(`document.querySelector('input[type=radio]').click();document.querySelector('.notes-editor').textContent='Synthetic browser test';document.querySelector('.notes-editor').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#submit').click()`);
  assert.equal(await browser.evaluate(`document.querySelector('#submit').disabled`), false);
  await browser.evaluate(`new Promise(resolve=>setTimeout(resolve,200))`);
  const received = ok(f.collect());
  assert.equal(received.status, 'received');
  assert.equal(received.answers[0].choice, 'Review first');
  assert.equal(received.answers[0].notes, 'Synthetic browser test');
  const {record} = ok(f.finish());
  assert.ok((await fs.readFile(record, 'utf8')).includes(input.questions[0].context));
  const network = browser.events.filter(e => e.method === 'Network.requestWillBeSent').map(e => e.params.request.url);
  assert.deepEqual(network.filter(url => /^https?:/.test(url)), []);
  assert.deepEqual(browser.events.filter(e => e.method === 'Runtime.exceptionThrown'), []);
});
