#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {normalizeSpec, validateSubmission, VERSION} from './model.mjs';

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
function collectNext(root, options = {}) {
  const args = ['collect', '--session', root];
  if (options.downloads) args.push('--downloads', path.resolve(options.downloads));
  if (options.answer) args.push('--answer', path.resolve(options.answer));
  return {...nextCommand('collect', ...args), when: 'user_done', instruction: 'End the turn. Run this command once only after the user says they have submitted. Do not poll or start a background process.'};
}
function finishNext(root, options = {}) {
  const args = ['finish', '--session', root];
  if (options.downloads) args.push('--downloads', path.resolve(options.downloads));
  return nextCommand('finish', ...args);
}
function outsidePlugin(project) {
  if (project === pluginRoot || project.startsWith(pluginRoot + path.sep)) fail('Choose the target project, not the jstack plugin directory');
}

async function regularFile(file, maxBytes = 2_000_000) {
  const st = await fs.lstat(file);
  if (!st.isFile() || st.isSymbolicLink()) fail(`Not a regular file: ${file}`);
  if (st.size > maxBytes) fail(`File too large: ${file}`);
  return fs.readFile(file, 'utf8');
}
async function exists(file) {
  try { await fs.lstat(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}
async function loadSession(input) {
  if (!input) fail('Missing --session');
  const root = path.resolve(input), st = await fs.lstat(root);
  if (!st.isDirectory() || st.isSymbolicLink() || !/^grill-form-[\w-]+$/.test(path.basename(root))) fail('Not a grill-form session directory');
  const actual = await fs.realpath(root);
  const state = JSON.parse(await regularFile(path.join(actual, 'session.json')));
  if (state.kind !== 'jstack-grill-form' || state.schemaVersion !== VERSION || state.directory !== actual || !/^[a-f0-9-]{36}$/.test(state.sessionId)) fail('Invalid session marker');
  state.spec = normalizeSpec(state.spec, {richText: state.richText === true});
  if (hash(JSON.stringify(state.spec)) !== state.specDigest) fail('Session question data was modified');
  if (typeof state.project !== 'string' || !path.isAbsolute(state.project)) fail('Session has no target project; preserve it and consult references/usage.md');
  outsidePlugin(state.project);
  return {root: actual, state};
}
async function saveJSON(file, data, exclusive = true) {
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', {mode: 0o600, flag: exclusive ? 'wx' : 'w'});
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
  const data = await regularFile(file), input = JSON.parse(data);
  return {path: file, sha256: hash(data), data: validateSubmission(state, input), submission: input};
}
async function readReceipt(root, state) {
  const receipt = JSON.parse(await regularFile(path.join(root, 'receipt.json')));
  if (receipt.sessionId !== state.sessionId || !Array.isArray(receipt.files) || !receipt.files.length) fail('Invalid receipt');
  const data = validateSubmission(state, receipt.submission);
  for (const file of receipt.files) {
    if (typeof file.path !== 'string' || !path.isAbsolute(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256)) fail('Invalid receipt file');
  }
  return {receipt, data};
}

async function create(options) {
  if (options.input && options.input !== '-') fail('Send the question JSON on stdin');
  if (!options.project) fail('Missing --project: supply the target project directory');
  const project = await fs.realpath(path.resolve(options.project));
  if (!(await fs.stat(project)).isDirectory()) fail('--project must be a directory');
  outsidePlugin(project);
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) { input += chunk; if (input.length > 200_000) fail('Question data is too large'); }
  const spec = normalizeSpec(JSON.parse(input), {richText: true});
  let raw = await fs.readFile(template, 'utf8');
  if (raw.split(marker).length !== 2) fail('Invalid prepared template: expected one question-data placeholder');
  if (raw.split(rendererMarker).length !== 2) fail('Invalid prepared template: expected one renderer placeholder');
  const descriptions = spec.questions.map(q => q.context).join('\n');
  const libraries = descriptions.trim() ? ['marked.js', 'purify.js'] : [];
  if (/mermaid/i.test(descriptions)) libraries.push('mermaid.js');
  const scripts = [];
  for (const name of libraries) {
    const source = await fs.readFile(new URL('../assets/vendor/' + name, import.meta.url), 'utf8');
    scripts.push('<script>\n' + source.replace(/<\/script/gi, '<\\/script').replace(/^\/\/# sourceMappingURL=.*$/gm, '') + '\n</script>');
  }
  raw = raw.replace(rendererMarker, () => scripts.join('\n'));
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'grill-form-')));
  try {
    const state = {kind: 'jstack-grill-form', schemaVersion: VERSION, richText: true, sessionId: randomUUID(), directory: root, project, createdAt: new Date().toISOString(), specDigest: hash(JSON.stringify(spec)), spec};
    const file = path.join(root, 'form.html');
    await fs.writeFile(file, raw.replace(marker, () => encode(state)), {mode: 0o600, flag: 'wx'});
    await saveJSON(path.join(root, 'session.json'), {...state, formDigest: hash(await fs.readFile(file))});
    output({status: 'created', session: root, html: file, url: pathToFileURL(file).href, answerFilename: `grill-form-${state.sessionId}.json`, message: 'Open the form in the browser, then end the turn.', next: collectNext(root)});
  } catch (e) { await fs.rm(root, {recursive: true, force: true}); throw e; }
}
async function collect(options) {
  const {root, state} = await loadSession(options.session);
  if (await exists(path.join(root, 'receipt.json'))) {
    const {data} = await readReceipt(root, state);
    if (options.answer) {
      const selected = await readAnswer(path.resolve(options.answer), state);
      if (JSON.stringify(selected.data) !== JSON.stringify(data)) fail('Different answers were already collected; preserve both submissions and resolve which round to retain');
    }
    output({status: 'received', recovered: true, ...data, next: finishNext(root, options)}); return;
  }
  const files = await candidates(state, options);
  if (files.length) {
    const incoming = await Promise.all(files.map(file => readAnswer(file, state)));
    if (incoming.some(x => JSON.stringify(x.data) !== JSON.stringify(incoming[0].data))) fail('Conflicting submissions; choose the intended file with --answer');
    const receipt = {sessionId: state.sessionId, receivedAt: new Date().toISOString(), submission: incoming[0].submission, files: incoming.map(({path, sha256}) => ({path, sha256}))};
    await saveJSON(path.join(root, 'receipt.json'), receipt);
    output({status: 'received', ...incoming[0].data, next: finishNext(root, options)}); return;
  }
  output({status: 'waiting', session: root, message: 'Answer download not found. End the turn; retry only when the user asks.', next: collectNext(root, options)});
}
function transcript(state, data) {
  let text = '---\ntitle: Interview answers\nsection: Journal\nupdated: ' + state.createdAt.slice(0, 10) + '\nstatus: Submitted\n---\n# Interview answers\n\nSubmitted answers; interpretation and accepted decisions are recorded through grill-me/plan.\n\nSession: `' + state.sessionId + '`\n';
  for (const answer of data.answers) {
    const question = state.spec.questions.find(q => q.id === answer.questionId);
    const content = ['Round: ' + data.title, 'Question: ' + question.prompt, (state.richText ? 'Description (Markdown source):\n' : 'Context: ') + question.context, 'Recommendation: ' + question.recommendation, 'Options: ' + question.options.map(o => o.label).join(' / '), 'Selected: ' + (answer.choice ?? '(notes only)'), 'Notes: ' + answer.notes].join('\n');
    const fence = '`'.repeat(Math.max(3, ...[...content.matchAll(/`+/g)].map(m => m[0].length + 1)));
    text += `\n## Question ${answer.number}\n\n${fence}text\n${content}\n${fence}\n`;
  }
  return text;
}
async function finish(options) {
  const {root, state} = await loadSession(options.session);
  if (!(await exists(path.join(root, 'receipt.json')))) fail('Collect the answers before finish');
  const {data} = await readReceipt(root, state);
  if (await fs.realpath(state.project) !== state.project) fail('Project path changed; nothing was deleted');
  let directory = state.project;
  for (const segment of ['docs', 'wiki', 'journal']) {
    directory = path.join(directory, segment);
    if (!(await exists(directory))) await fs.mkdir(directory);
    const st = await fs.lstat(directory);
    if (st.isSymbolicLink() || !st.isDirectory()) fail('Wiki path is not a regular directory; nothing was deleted');
  }
  const record = path.join(directory, `${state.createdAt.slice(0, 10)}-grill-${state.sessionId}.md`);
  const body = transcript(state, data);
  if (await exists(record)) {
    if (await regularFile(record) !== body) fail('Saved transcript changed; nothing was deleted');
  } else await fs.writeFile(record, body, {mode: 0o600, flag: 'wx'});
  // Verify the durable copy before deleting any session or answer file.
  if (await regularFile(record) !== body) fail('Transcript verification failed; nothing was deleted');
  await cleanup({...options, recorded: true, record});
}
async function cleanup(options) {
  if (!!options.recorded === !!options.discard) fail('Use finish to preserve answers, or cleanup --discard only after explicit cancellation');
  const {root, state} = await loadSession(options.session);
  const allowed = new Set(['form.html', 'session.json', 'receipt.json', '.DS_Store']);
  const names = await fs.readdir(root);
  if (names.some(n => !allowed.has(n))) fail('Unexpected files in the session; nothing was deleted');
  for (const n of names) await regularFile(path.join(root, n), n === 'form.html' ? 10_000_000 : 2_000_000);
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
  output(options.record ? {status: 'finished', record: options.record, next: {action: 'interpret', instruction: 'Use the saved transcript with grill-me. Update accepted decisions and open questions in the target wiki, link this journal, then build/check the wiki.'}} : {status: 'cleaned', session: root});
}

const [command, ...args] = process.argv.slice(2);
const allowedOptions = {
  create: new Set(['input', 'project']),
  collect: new Set(['session', 'answer', 'downloads']),
  finish: new Set(['session', 'downloads']),
  cleanup: new Set(['session', 'downloads', 'discard']),
};
try {
  if (!allowedOptions[command]) fail('Usage: grill-form.mjs create --project PATH < questions.json | collect --session PATH | finish --session PATH | cleanup --session PATH --discard');
  const options = {};
  while (args.length) {
    const flag = args.shift();
    if (!flag.startsWith('--') || !allowedOptions[command].has(flag.slice(2)) || Object.hasOwn(options, flag.slice(2))) fail(`Unknown or repeated option: ${flag}`);
    const key = flag.slice(2);
    if (key === 'discard') options[key] = true;
    else { const value = args.shift(); if (!value || value.startsWith('--')) fail(`Missing value for ${flag}`); options[key] = value; }
  }
  await ({create, collect, finish, cleanup}[command])(options);
} catch (e) { process.stderr.write(JSON.stringify({status: 'error', message: e.message, help: fileURLToPath(new URL('../references/usage.md', import.meta.url)), instruction: 'Preserve existing files. Correct the reported input or consult help; do not bypass validation.'}) + '\n'); process.exitCode = 1; }
