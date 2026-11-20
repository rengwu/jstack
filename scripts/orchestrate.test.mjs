import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const script = fileURLToPath(new URL('../skills/orchestrate/scripts/wait-for-message.mjs', import.meta.url));

async function mailbox(t, text) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jstack-orchestrate-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'to-orchestrator.md');
  if (text !== undefined) await fs.writeFile(file, text);
  return file;
}

function run(args) {
  const child = spawn(process.execPath, [script, ...args]);
  let stdout = '', stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  const done = new Promise((resolve) => child.on('exit', (code) => resolve({ code, stdout, stderr })));
  return { child, done };
}

test('prints only messages appended after the starting count', async (t) => {
  const file = await mailbox(t, '## 2026-11-20T10:00Z Old\n\nold body\n');
  const { done } = run(['--file', file]);
  await new Promise((r) => setTimeout(r, 300));
  await fs.appendFile(file, '\n## 2026-11-20T10:05Z Report\n\nnew body\n');
  const { code, stdout } = await done;
  assert.equal(code, 0);
  assert.match(stdout, /^2 messages/);
  assert.match(stdout, /Report\n\nnew body/);
  assert.doesNotMatch(stdout, /old body/);
});

test('returns at once when --after is already exceeded', async (t) => {
  const file = await mailbox(t, '## a\n\none\n## b\n\ntwo\n');
  const { code, stdout } = await run(['--file', file, '--after', '1']).done;
  assert.equal(code, 0);
  assert.match(stdout, /## b\n\ntwo/);
  assert.doesNotMatch(stdout, /one/);
});

test('waits for a file that does not exist yet', async (t) => {
  const file = await mailbox(t);
  const { done } = run(['--file', file]);
  await new Promise((r) => setTimeout(r, 300));
  await fs.writeFile(file, '## first\n\nhello\n');
  const { code, stdout } = await done;
  assert.equal(code, 0);
  assert.match(stdout, /hello/);
});

test('ignores ## inside a line and times out with exit 2', async (t) => {
  const file = await mailbox(t, 'text ## not a header\n');
  const { code, stderr } = await run(['--file', file, '--after', '0', '--timeout', '1']).done;
  assert.equal(code, 2);
  assert.match(stderr, /No new message/);
});
