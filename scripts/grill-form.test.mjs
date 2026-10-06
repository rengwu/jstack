import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {normalizeSpec, validateSubmission} from '../skills/grill-form/scripts/model.mjs';
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
async function fixture(t, input = spec) {
  const downloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jstack-grill-downloads-'));
  const projectPath = path.join(downloadDir, 'project'); await fs.mkdir(projectPath);
  const project = await fs.realpath(projectPath);
  const created = ok(run(['create', '--project', project], input));
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
  assert.ok(Buffer.byteLength(html) < 16000);
  assert.doesNotMatch(html, /<img src=x|<script>alert|<script[^>]+src=|fetch\(|XMLHttpRequest|WebSocket|__GRILL_FORM_DATA__/);
  assert.match(html, /connect-src 'none'/);
  const embedded = JSON.parse(html.match(/<script type="application\/json" id="grill-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(embedded.spec.title, input.title);
  assert.equal(embedded.spec.questions[0].number, 8);
  assert.match(f.url, /^file:\/\//);
});

test('collect checks once and exits without adding artifacts or scheduling an automatic retry', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.downloadDir, 'unrelated.json'), 'private');
  const result = ok(f.collect());
  assert.equal(result.status, 'waiting');
  assert.equal(result.next.when, 'user_done');
  assert.match(result.message, /End the turn/);
  assert.ok(!result.next.argv.includes('--wait-seconds'));
  assert.equal((await fs.readdir(f.session)).length, 2);
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

test('created form defers collection until user completion; a later invocation receives the download', async t => {
  const f = await fixture(t);
  assert.equal(f.next.when, 'user_done');
  assert.match(f.next.instruction, /End the turn/);
  assert.ok(!f.next.argv.includes('--wait-seconds'));
  assert.equal(ok(f.collect()).status, 'waiting');
  await f.write();
  assert.equal(ok(f.collect()).status, 'received');
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
  assert.match(html, /fieldset/); assert.match(html, /textarea/); assert.match(html, /type="submit"/);
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
  assert.ok(Buffer.byteLength(html) > 2_000_000, 'diagram runtime should be embedded');
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
  delete legacy.richText;
  legacy.specDigest = createHash('sha256').update(JSON.stringify(legacy.spec)).digest('hex');
  await fs.writeFile(path.join(f.session, 'session.json'), JSON.stringify(legacy));
  await f.write({...f.payload, specDigest: legacy.specDigest});
  ok(f.collect());
  const {record} = ok(f.finish());
  const saved = await fs.readFile(record, 'utf8');
  assert.match(saved, /Context: Plain context\n/);
  assert.doesNotMatch(saved, /Description \(Markdown source\)/);
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
  const rendered = await browser.evaluate(`({ready:document.querySelectorAll('.diagram[data-render-state=ready] svg').length,errors:document.querySelectorAll('.diagram-error').length,table:document.querySelectorAll('table tbody tr').length,bold:document.querySelector('strong')?.textContent,question:document.querySelector('legend').textContent,code:document.querySelector('code.language-js')?.textContent,injected:!!globalThis.__grillTestInjected,images:document.querySelectorAll('img').length,unsafeLinks:[...document.querySelectorAll('a[href]')].some(a=>!a.href.startsWith('https://')),fallbacks:[...document.querySelectorAll('.diagram[data-render-state=error] pre')].map(p=>p.textContent)})`);
  assert.equal(rendered.ready, 3, JSON.stringify(rendered)); assert.equal(rendered.errors, 3);
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
  await browser.evaluate(`document.querySelector('input[type=radio]').click();document.querySelector('textarea').value='Synthetic browser test';document.querySelector('textarea').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#submit').click()`);
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
