#!/usr/bin/env node
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {normalizeSpec, validateSubmission, validRegion, VERSION, IMAGE_LIMITS, IMAGE_EXTENSIONS, SUBMISSION_BYTES, SPEC_BYTES} from './model.mjs';
import {start} from '../../../scripts/input-completion.mjs';
import {openBrowser} from './open.mjs';

const template = fileURLToPath(new URL('../assets/form.template.html', import.meta.url));
const marker = '__GRILL_FORM_DATA__';
const rendererMarker = '__GRILL_FORM_RENDERERS__';
const hash = text => createHash('sha256').update(text).digest('hex');
const encode = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const output = value => process.stdout.write(JSON.stringify(value, null, 2) + '\n');
const fail = message => { throw new Error(message); };
const cli = fileURLToPath(import.meta.url);
const pluginRoot = path.resolve(path.dirname(cli), '../../..');
const quote = value => "'" + String(value).replace(/'/g, "'\\''") + "'";
function nextCommand(action, ...args) {
  const argv = [process.execPath, cli, ...args];
  return {action, command: argv.map(quote).join(' '), argv};
}
function collectionCommand(action, root, options = {}) {
  const args = [action, '--session', root];
  if (options.downloads) args.push('--downloads', path.resolve(options.downloads));
  if (options.answer) args.push('--answer', path.resolve(options.answer));
  if (options.details) args.push('--details');
  if (['wait', 'complete'].includes(action) && options['timeout-seconds']) args.push('--timeout-seconds', options['timeout-seconds']);
  return nextCommand(action, ...args);
}
function finishNext(root, options = {}) {
  const args = ['finish', '--session', root];
  if (options.downloads) args.push('--downloads', path.resolve(options.downloads));
  return nextCommand('finish', ...args);
}
function outsidePlugin(project) {
  if (project === pluginRoot || project.startsWith(pluginRoot + path.sep)) fail('Choose the target project, not the jstack plugin directory');
}

async function regularBytes(file, maxBytes = 2_000_000) {
  const st = await fs.lstat(file);
  if (!st.isFile() || st.isSymbolicLink()) fail(`Not a regular file: ${file}`);
  if (st.size > maxBytes) fail(`File too large: ${file}`);
  return fs.readFile(file);
}
async function regularFile(file, maxBytes) { return (await regularBytes(file, maxBytes)).toString('utf8'); }
async function exists(file) {
  try { await fs.lstat(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}
async function ensureDirectory(directory) {
  if (!(await exists(directory))) await fs.mkdir(directory, {mode: 0o700});
  const st = await fs.lstat(directory);
  if (st.isSymbolicLink() || !st.isDirectory()) fail('Destination is not a regular directory; nothing was deleted');
}
async function loadSession(input) {
  if (!input) fail('Missing --session');
  const root = path.resolve(input), st = await fs.lstat(root);
  if (!st.isDirectory() || st.isSymbolicLink() || !/^grill-form-[\w-]+$/.test(path.basename(root))) fail('Not a grill-form session directory');
  const actual = await fs.realpath(root);
  const state = JSON.parse(await regularFile(path.join(actual, 'session.json'), SPEC_BYTES * 4));
  if (state.kind !== 'jstack-grill-form' || state.schemaVersion !== VERSION || state.directory !== actual || !/^[a-f0-9-]{36}$/.test(state.sessionId)) fail('Invalid session marker');
  state.spec = normalizeSpec(state.spec, {richText: state.richText === true, review: state.review === true});
  if (hash(JSON.stringify(state.spec)) !== state.specDigest) fail('Session question data was modified');
  if (typeof state.project !== 'string' || !path.isAbsolute(state.project)) fail('Session has no target project; preserve it and consult references/usage.md');
  if (state.temporary !== true) outsidePlugin(state.project);
  return {root: actual, state};
}
async function saveJSON(file, data, exclusive = true) {
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', {mode: 0o600, flag: exclusive ? 'wx' : 'w'});
}
async function waitState(root, state) {
  const file = await fs.open(path.join(root, '.wait'), constants.O_WRONLY | constants.O_CREAT | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0), 0o600);
  try {
    if (!(await file.stat()).isFile()) fail('Invalid wait state');
    await file.truncate(); await file.writeFile(state + '\n');
  } finally { await file.close(); }
}
function downloadPattern(state) {
  return new RegExp(`^grill-form-${state.sessionId}(?: \\(\\d+\\)|-\\d+)?\\.json$`);
}
async function candidates(state, options) {
  if (options.answer) return [path.resolve(options.answer)];
  const directory = path.resolve(options.downloads ?? path.join(os.homedir(), 'Downloads'));
  let names;
  try { names = await fs.readdir(directory); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  return names.filter(n => downloadPattern(state).test(n)).sort().map(n => path.join(directory, n));
}
async function readAnswer(file, state) {
  const data = await regularFile(file, SUBMISSION_BYTES), input = JSON.parse(data);
  return {path: file, sha256: hash(data), data: validateSubmission(state, input), submission: input};
}
async function readReceipt(root, state) {
  const receipt = JSON.parse(await regularFile(path.join(root, 'receipt.json'), SUBMISSION_BYTES));
  if (receipt.sessionId !== state.sessionId || !Array.isArray(receipt.files) || !receipt.files.length) fail('Invalid receipt');
  const data = validateSubmission(state, receipt.submission);
  for (const file of receipt.files) {
    if (typeof file.path !== 'string' || !path.isAbsolute(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256)) fail('Invalid receipt file');
  }
  return {receipt, data};
}

async function create(options) {
  if (options.browser && !options.open) fail('Use --open with --browser');
  if (!options.project) fail('Missing --project: supply the target project directory');
  const project = await fs.realpath(path.resolve(options.project));
  if (!(await fs.stat(project)).isDirectory()) fail('--project must be a directory');
  if (!options.temporary) outsidePlugin(project);
  let input = '';
  if (options.input && options.input !== '-') input = await regularFile(path.resolve(options.input), SPEC_BYTES);
  else {
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) { input += chunk; if (Buffer.byteLength(input) > SPEC_BYTES) fail('Question data is too large'); }
  }
  const spec = normalizeSpec(JSON.parse(input.replace(/^\uFEFF/, '')), {richText: true, review: true});
  let raw = await fs.readFile(template, 'utf8');
  if (raw.split(marker).length !== 2) fail('Invalid prepared template: expected one question-data placeholder');
  if (raw.split(rendererMarker).length !== 2) fail('Invalid prepared template: expected one renderer placeholder');
  const descriptions = spec.questions.map(q => q.context).join('\n');
  const libraries = descriptions.trim() ? ['marked.js', 'purify.js'] : [];
  if (/mermaid/i.test(descriptions)) libraries.push('pele.js');
  const scripts = [];
  scripts.push('<script>\n' + validRegion.toString() + '\n</script>');
  for (const asset of ['notes-editor.js','review.js']) scripts.push('<script>\n' + await fs.readFile(new URL('../assets/'+asset, import.meta.url), 'utf8') + '\n</script>');
  for (const name of libraries) {
    const source = await fs.readFile(new URL('../assets/vendor/' + name, import.meta.url), 'utf8');
    scripts.push('<script>\n' + source.replace(/<\/script/gi, '<\\/script').replace(/^\/\/# sourceMappingURL=.*$/gm, '') + '\n</script>');
  }
  raw = raw.replace(rendererMarker, () => scripts.join('\n'));
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'grill-form-')));
  try {
    const state = {kind: 'jstack-grill-form', schemaVersion: VERSION, richText: true, review: true, imageLimits: IMAGE_LIMITS, temporary: !!options.temporary, sessionId: randomUUID(), directory: root, project, projectName: path.basename(project), createdAt: new Date().toISOString(), specDigest: hash(JSON.stringify(spec)), spec};
    const file = path.join(root, 'form.html');
    await fs.writeFile(file, raw.replace(marker, () => encode(state)), {mode: 0o600, flag: 'wx'});
    await saveJSON(path.join(root, 'session.json'), {...state, formDigest: hash(await fs.readFile(file))});
    const url = pathToFileURL(file).href;
    const launch = options.open ? await openBrowser(url, options.browser) : undefined;
    output({status: 'created', session: root, html: file, url, ...(launch ? {launch} : {}), open: nextCommand('open', 'open', '--session', root), answerFilename: `grill-form-${state.sessionId}.json`, completion: collectionCommand('complete', root), wait: collectionCommand('wait', root), next: collectionCommand('collect', root)});
  } catch (e) { await fs.rm(root, {recursive: true, force: true}); throw e; }
}
async function open(options) {
  const {root} = await loadSession(options.session);
  const html = path.join(root, 'form.html'), url = pathToFileURL(html).href;
  await regularBytes(html, SPEC_BYTES * 8);
  output({session: root, html, url, launch: await openBrowser(url, options.browser)});
}
async function collect(options) {
  const {root, state} = await loadSession(options.session);
  await waitState(root, 'stopped');
  const received = await collectAnswers(root, state, options);
  output(received ?? {status: 'waiting', session: root, next: collectionCommand('collect', root, options)});
}
async function collectAnswers(root, state, options) {
  if (await exists(path.join(root, 'receipt.json'))) {
    const {data} = await readReceipt(root, state);
    if (options.answer) {
      const selected = await readAnswer(path.resolve(options.answer), state);
      if (JSON.stringify(selected.data) !== JSON.stringify(data)) fail('Different answers were already collected; preserve both submissions and resolve which round to retain');
    }
    return {status: 'received', recovered: true, ...collectedFeedback(data, options), next: finishNext(root, options)};
  }
  const files = await candidates(state, options);
  if (files.length) {
    const incoming = await Promise.all(files.map(file => readAnswer(file, state)));
    if (incoming.some(x => JSON.stringify(x.data) !== JSON.stringify(incoming[0].data))) fail('Conflicting submissions; choose the intended file with --answer');
    const receipt = {sessionId: state.sessionId, receivedAt: new Date().toISOString(), submission: incoming[0].submission, files: incoming.map(({path, sha256}) => ({path, sha256}))};
    await saveJSON(path.join(root, 'receipt.json'), receipt);
    return {status: 'received', ...collectedFeedback(incoming[0].data, options), next: finishNext(root, options)};
  }
  return null;
}
function answerSummary(data) {
  const summary = answer => ({...answer, ...(answer.images ? {images: answer.images.map(({dataUrl, ...image}) => image)} : {}), ...(answer.comments ? {comments: answer.comments.map(summary)} : {})});
  return {...data, answers: data.answers.map(summary)};
}
function collectedFeedback(data, options) {
  const summary = answerSummary(data);
  if (options.details) return summary;
  return {...summary, answers: summary.answers.map(({states, comments, ...answer}) => ({
    ...answer,
    ...(states && Object.keys(states).length ? {finalStates: states} : {}),
    ...(comments?.length ? {comments: comments.map(({preview, notes, images, state, anchor}, index) => ({
      number: index + 1, notes, ...(images ? {images} : {}), preview,
      ...(anchor ? {anchor} : {area: 'selected region'}), stateAtComment: state,
    }))} : {}),
  }))};
}
async function complete(options) {
  const {root} = await loadSession(options.session);
  const result = await start(collectionCommand('wait', root, options).argv);
  if (result.status === 'error') fail(result.message);
  output(result);
}
// The collector owns its attempt, cancellation, and delivery state in one file.
async function wait(options) {
  const seconds = options['timeout-seconds'] ?? '3600';
  if (!/^[1-9]\d*$/.test(seconds) || Number(seconds) > 86400) fail('--timeout-seconds must be an integer from 1 to 86400');
  const notify = options.notify && JSON.parse(options.notify);
  if (options.notify && (!Array.isArray(notify) || !notify.length || notify.some(x => typeof x !== 'string' || x.includes('\0')) || !notify[0])) fail('Invalid notification command');
  const {root, state} = await loadSession(options.session);
  const manual = reason => output({status: notify ? 'fallback' : 'waiting', reason, session: root, next: collectionCommand('collect', root, options)});
  // Old sessions keep their previous no-restart guarantee.
  for (const name of ['poll.stop', 'wait.started.json', 'completion.json']) {
    if (await exists(path.join(root, name))) { manual('already_started'); return; }
  }
  try { await fs.writeFile(path.join(root, '.wait'), 'waiting\n', {flag: 'wx', mode: 0o600}); }
  catch (e) { if (e.code === 'EEXIST') { manual('already_started'); return; } throw e; }
  if (notify) output({status: 'armed', session: root});
  const deadline = Date.now() + Number(seconds) * 1000;
  try {
    while (true) {
      if (!(await exists(root))) { if (!notify) output({status: 'stopped'}); return; }
      if ((await regularFile(path.join(root, '.wait'))).startsWith('stopped')) { if (!notify) manual('stopped'); return; }
      if (Date.now() >= deadline) {
        await waitState(root, 'timed_out'); if (!notify) manual('timeout'); return;
      }
      const received = await collectAnswers(root, state, options);
      if (received) {
        await waitState(root, 'received');
        if (!notify) { output(received); return; }
        const message = `grill-form ready: ${JSON.stringify(root)}`;
        const argv = notify.map(arg => arg === '{message}' ? message : arg);
        await promisify(execFile)(argv[0], argv.slice(1), {timeout: 15000});
        await waitState(root, 'notified'); return;
      }
      await sleep(Math.min(1000, deadline - Date.now()));
    }
  } catch (e) {
    if (await exists(root)) await waitState(root, 'failed: ' + e.message);
    if (!notify) throw e;
  }
}
// Old saved commands degrade to one manual check instead of reviving a loop.
async function poll(options) { await collect(options); }
const imageFilename = image => `image-${image.id}.${IMAGE_EXTENSIONS[image.mimeType]}`;
function transcript(state, data, imageDirectory, previewFile) {
  let text = '---\ntitle: Interview answers\nsection: Journal\nupdated: ' + state.createdAt.slice(0, 10) + '\nstatus: Submitted\n---\n# Interview answers\n\nSubmitted answers; interpretation and accepted decisions are recorded through grill-me/plan.\n\nSession: `' + state.sessionId + '`\n';
  if (previewFile) text += `\n[Saved visual review${previewFile.endsWith('.json') ? ' source' : ''}](${previewFile})\n\nPreview revision: \`${state.specDigest}\`\n`;
  for (const answer of data.answers) {
    const question = state.spec.questions.find(q => q.id === answer.questionId);
    const content = ['Round: ' + data.title, 'Question: ' + question.prompt, (state.richText ? 'Description (Markdown source):\n' : 'Context: ') + question.context, 'Recommendation: ' + question.recommendation, 'Options: ' + question.options.map(o => o.label).join(' / '), 'Selected: ' + (answer.choice ?? (!state.review ? '(notes only)' : answer.status === 'untouched' ? '(untouched; no approval)' : '(notes or adjustments only)')), 'Notes: ' + answer.notes, ...(state.review ? ['Status: '+answer.status, 'Prototype states: '+JSON.stringify(answer.states), 'Comments: '+JSON.stringify(answerSummary({answers:answer.comments}).answers)] : [])].join('\n');
    const fence = '`'.repeat(Math.max(3, ...[...content.matchAll(/`+/g)].map(m => m[0].length + 1)));
    text += `\n## Question ${answer.number}\n\n${fence}text\n${content}\n${fence}\n`;
    for (const image of [answer,...(answer.comments ?? [])].flatMap(a=>a.images ?? [])) text += `\n![Image #${image.id}](${imageDirectory}/${imageFilename(image)})\n`;
  }
  return text;
}
async function finish(options) {
  const {root, state} = await loadSession(options.session);
  if (!(await exists(path.join(root, 'receipt.json')))) fail('Collect the answers before finish');
  const {data} = await readReceipt(root, state);
  if (await fs.realpath(state.project) !== state.project) fail('Project path changed; nothing was deleted');
  let directory = state.temporary === true ? await fs.realpath(os.tmpdir()) : state.project;
  for (const segment of state.temporary === true ? [] : ['docs', 'wiki', 'journal']) {
    directory = path.join(directory, segment);
    await ensureDirectory(directory);
  }
  const record = path.join(directory, `${state.createdAt.slice(0, 10)}-grill-${state.sessionId}.md`);
  const imageDirectory = path.basename(record, '.md') + '-images';
  const images = data.answers.flatMap(a => [a,...(a.comments ?? [])]).flatMap(a=>a.images ?? []);
  const imageParent = state.temporary === true ? directory : path.join(path.dirname(directory), 'attachments');
  const destination = path.join(imageParent, imageDirectory);
  if (images.length) {
    await ensureDirectory(imageParent);
    await ensureDirectory(destination);
    for (const image of images) {
      const file = path.join(destination, imageFilename(image));
      const bytes = Buffer.from(image.dataUrl.split(',')[1], 'base64');
      if (!(await exists(file))) await fs.writeFile(file, bytes, {mode: 0o600, flag: 'wx'});
      if (!(await regularBytes(file, IMAGE_LIMITS.fileBytes)).equals(bytes)) fail('Saved image changed; nothing was deleted');
    }
  }
  let previewFile, previewLink;
  if (state.spec.questions.some(q=>q.preview||q.options.some(o=>o.preview))) {
    await ensureDirectory(imageParent);
    previewFile = path.join(imageParent, path.basename(record,'.md')+'-review.html');
    const original = await regularFile(path.join(root,'form.html'), SPEC_BYTES * 8);
    if (hash(original) !== state.formDigest) fail('Form was modified; nothing was deleted');
    const archived = {...state, archived:true, savedAnswers:data.answers};
    const saved = original.replace(/(<script type="application\/json" id="grill-data">)[\s\S]*?(<\/script>)/, (_,open,close)=>open+encode(archived)+close);
    if (!(await exists(previewFile))) await fs.writeFile(previewFile,saved,{mode:0o600,flag:'wx'});
    if (await regularFile(previewFile,SPEC_BYTES*8+SUBMISSION_BYTES) !== saved) fail('Saved review changed; nothing was deleted');
    previewLink = path.basename(previewFile);
    // The wiki supports JSON attachments, not executable HTML. Keep its reader
    // unchanged and link the review's source/state record; return the HTML path.
    if (!state.temporary) {
      const sourceFile = previewFile.replace(/\.html$/,'.json');
      const source = JSON.stringify({specDigest:state.specDigest, spec:state.spec, answers:answerSummary(data).answers, preview:{file:path.basename(previewFile),sha256:hash(saved)}},null,2)+'\n';
      if (!(await exists(sourceFile))) await fs.writeFile(sourceFile,source,{mode:0o600,flag:'wx'});
      if (await regularFile(sourceFile,SPEC_BYTES*8+SUBMISSION_BYTES) !== source) fail('Saved review source changed; nothing was deleted');
      previewLink = path.basename(sourceFile);
    }
  }
  const relativePrefix = state.temporary === true ? '' : '../attachments/';
  const body = transcript(state, data, relativePrefix + imageDirectory, previewLink && relativePrefix + previewLink);
  if (await exists(record)) {
    if (await regularFile(record, SUBMISSION_BYTES) !== body) fail('Saved transcript changed; nothing was deleted');
  } else await fs.writeFile(record, body, {mode: 0o600, flag: 'wx'});
  // Verify the durable copy before deleting any session or answer file.
  if (await regularFile(record, SUBMISSION_BYTES) !== body) fail('Transcript verification failed; nothing was deleted');
  await cleanup({...options, recorded: true, record, preview: previewFile, images: images.map(image => ({id: image.id, path: path.join(destination, imageFilename(image))}))});
}
async function cleanup(options) {
  if (!!options.recorded === !!options.discard) fail('Use finish to preserve answers, or cleanup --discard only after explicit cancellation');
  const {root, state} = await loadSession(options.session);
  await waitState(root, 'stopped');
  const allowed = new Set(['form.html', 'session.json', 'receipt.json', 'poll.stop', 'polling.json', 'polling.next.json', 'wait.started.json', 'completion.json', '.wait', '.DS_Store']);
  const names = await fs.readdir(root);
  if (names.some(n => !allowed.has(n))) fail('Unexpected files in the session; nothing was deleted');
  for (const n of names) await regularFile(path.join(root, n), n === 'form.html' ? SPEC_BYTES * 8 : n === 'receipt.json' ? SUBMISSION_BYTES : n === 'session.json' ? SPEC_BYTES * 4 : 2_000_000);
  if (await exists(path.join(root, 'form.html')) && hash(await fs.readFile(path.join(root, 'form.html'))) !== state.formDigest) fail('Form was modified; nothing was deleted');
  const hasReceipt = await exists(path.join(root, 'receipt.json'));
  if (options.recorded && !hasReceipt) fail('Collect the answers before finish');
  const files = hasReceipt ? (await readReceipt(root, state)).receipt.files : [];
  const downloads = await candidates(state, options);
  for (const file of downloads) {
    if (!files.some(f => f.path === file)) {
      const extra = await readAnswer(file, state);
      // Preserve a later, different submission until the agent explicitly resolves it.
      if (hasReceipt && JSON.stringify(extra.data) !== JSON.stringify((await readReceipt(root, state)).data)) fail('A different answer download exists; nothing was deleted');
      files.push({path: file, sha256: extra.sha256});
    }
  }
  // Preflight every file before deleting anything. Never recurse into Downloads.
  for (const file of files) {
    if (!(await exists(file.path))) continue;
    const answer = await readAnswer(file.path, state);
    if (answer.sha256 !== file.sha256) fail(`Answer file changed; nothing was deleted: ${file.path}`);
  }
  for (const file of files) if (await exists(file.path)) await fs.unlink(file.path);
  for (const n of names) await fs.unlink(path.join(root, n));
  await fs.rmdir(root);
  output(options.record ? {status: 'finished', record: options.record, ...(options.preview ? {preview:options.preview} : {}), ...(options.images?.length ? {images: options.images} : {}), next: {action: 'interpret', instruction: state.temporary === true ? 'Interpret the temporary feedback, captured preview state, and linked images through the review or grill-me/plan. Follow the project record rules; do not initialize a wiki automatically.' : 'Interpret the saved feedback, captured preview state, and linked images through the review or grill-me. Update accepted decisions and open questions in the target wiki, link this journal, then build/check the wiki.'}} : {status: 'cleaned', session: root});
}

const [command, ...args] = process.argv.slice(2);
const allowedOptions = {
  create: new Set(['input', 'project', 'temporary', 'open', 'browser']),
  open: new Set(['session', 'browser']),
  collect: new Set(['session', 'answer', 'downloads', 'details']),
  poll: new Set(['session', 'answer', 'downloads', 'max-wait-seconds']),
  wait: new Set(['session', 'answer', 'downloads', 'timeout-seconds', 'notify', 'details']),
  complete: new Set(['session', 'answer', 'downloads', 'timeout-seconds', 'details']),
  finish: new Set(['session', 'downloads']),
  cleanup: new Set(['session', 'downloads', 'discard']),
};
try {
  if (Number(process.versions.node.split('.')[0]) < 22) fail('grill-form requires Node.js 22 or newer');
  if (!allowedOptions[command]) fail('Usage: grill-form.mjs create --project PATH --input questions.json [--open] | open --session PATH | wait|complete --session PATH | collect --session PATH | finish --session PATH | cleanup --session PATH --discard');
  const options = {};
  while (args.length) {
    const flag = args.shift();
    if (!flag.startsWith('--') || !allowedOptions[command].has(flag.slice(2)) || Object.hasOwn(options, flag.slice(2))) fail(`Unknown or repeated option: ${flag}`);
    const key = flag.slice(2);
    if (['discard', 'temporary', 'open', 'details'].includes(key)) options[key] = true;
    else { const value = args.shift(); if (!value || value.startsWith('--')) fail(`Missing value for ${flag}`); options[key] = value; }
  }
  await ({create, open, collect, wait, complete, poll, finish, cleanup}[command])(options);
} catch (e) { process.stderr.write(JSON.stringify({status: 'error', message: e.message, help: fileURLToPath(new URL('../references/usage.md', import.meta.url)), instruction: 'Preserve existing files. Correct the reported input or consult help; do not bypass validation.'}) + '\n'); process.exitCode = 1; }
