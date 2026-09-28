import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const source=fileURLToPath(new URL('../skills/planning-wiki/assets/_build.mjs',import.meta.url));
async function fixture(t, files={}) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'jstack-reader-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.copyFile(source,path.join(root,'_build.mjs'));
  for (const [name,content] of Object.entries({'index.md':'# Test wiki\n',...files})) {
    const target=path.join(root,name);
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.writeFile(target,content);
  }
  return {root,run:(...args)=>spawnSync(process.execPath,[path.join(root,'_build.mjs'),...args],{encoding:'utf8'}),html:()=>fs.readFile(path.join(root,'index.html'),'utf8')};
}
function passes(result) { assert.equal(result.status,0,result.stderr); }
function fails(result,pattern) { assert.notEqual(result.status,0);assert.match(result.stderr,pattern); }

test('original Markdown navigation, duplicate anchors, and stale snapshot detection',async t=>{
  const f=await fixture(t,{'index.md':'# Test wiki\n[Topic](topics/a.md#repeat-1)\n','topics/a.md':'# Topic\n## Repeat\nFirst\n## Repeat\nSecond\n'});
  passes(f.run());passes(f.run('--check'));
  assert.match(await f.html(),/#\/topics\/a~repeat-1/);
  await fs.appendFile(path.join(f.root,'topics/a.md'),'\nChanged.\n');
  fails(f.run('--check'),/stale/);
});

test('nested report resolves an encoded evidence link relative to the HTML and hashes its contents',async t=>{
  const f=await fixture(t,{'index.md':'# Test wiki\n[Run](verification/runs/one.md)\n','verification/runs/one.md':'---\nresult: Passed\n---\n# Run\n[Evidence](../../evidence/one/a%20%23%20b.txt)\n','evidence/one/a # b.txt':'actual observation\n'});
  passes(f.run());passes(f.run('--check'));
  const html=await f.html();
  assert.match(html,/evidence\/one\/a%20%23%20b.txt/);
  assert.ok(html.includes(createHash('sha256').update('actual observation\n').digest('hex')));
  assert.match(html,/"result":"Passed"/);
  await fs.writeFile(path.join(f.root,'evidence/one/a # b.txt'),'changed evidence\n');
  fails(f.run('--check'),/stale/);
});

test('planning status and verification outcome are separate; results cannot certify feature pages',async t=>{
  const f=await fixture(t,{'verification/runs/one.md':'---\nstatus: Accepted\nresult: Untested\n---\n# Run\n'});
  passes(f.run());
  assert.match(await f.html(),/"status":"Accepted","result":"Untested"/);
  await fs.mkdir(path.join(f.root,'features'));
  await fs.writeFile(path.join(f.root,'features/one.md'),'---\nresult: Passed\n---\n# Feature\n');
  fails(f.run(),/Verification result/);
});

test('missing evidence, invalid outcome, and broken Markdown targets fail the build',async t=>{
  const f=await fixture(t,{'index.md':'# Test wiki\n[Evidence](evidence/missing.png)\n'});
  fails(f.run(),/Missing or symlinked evidence/);
  await fs.writeFile(path.join(f.root,'index.md'),'# Test wiki\n[Missing](missing.md)\n');
  fails(f.run(),/Broken link/);
  await fs.writeFile(path.join(f.root,'index.md'),'# Test wiki\n');
  await fs.mkdir(path.join(f.root,'verification/runs'),{recursive:true});
  await fs.writeFile(path.join(f.root,'verification/runs/one.md'),'---\nresult: Green\n---\n# Run\n');
  fails(f.run(),/Verification result/);
});

test('attachments cannot escape evidence, follow symlinks, or link executable HTML',async t=>{
  const f=await fixture(t,{'outside.txt':'outside','evidence/one.txt':'inside','evidence/page.html':'<script>alert(1)</script>'});
  for (const href of ['outside.txt','../outside.txt','%2Fetc/passwd','evidence/page.html']) {
    await fs.writeFile(path.join(f.root,'index.md'),'# Test wiki\n[Bad]('+href+')\n');
    fails(f.run(),/Unsupported evidence|relative link/);
  }
  await fs.symlink(path.join(f.root,'outside.txt'),path.join(f.root,'evidence/link.txt'));
  await fs.writeFile(path.join(f.root,'index.md'),'# Test wiki\n[Bad](evidence/link.txt)\n');
  fails(f.run(),/symlinked evidence/);
  await fs.symlink(f.root,path.join(f.root,'evidence/linked-dir'));
  await fs.writeFile(path.join(f.root,'index.md'),'# Test wiki\n[Bad](evidence/linked-dir/outside.txt)\n');
  fails(f.run(),/symlinked evidence/);
});

test('a duplicate attachment cannot bypass fragment validation',async t=>{
  const f=await fixture(t,{'index.md':'# Test wiki\n[One](evidence/a.txt)\n[Two](evidence/a.txt#fragment)\n','evidence/a.txt':'text'});
  fails(f.run(),/Unsupported evidence/);
});

test('inline images remain unsupported and HTML injection is sanitized',async t=>{
  const f=await fixture(t,{'index.md':'# Test wiki\n![Inline](evidence/a.png)\n'});
  fails(f.run(),/Images are not embedded/);
  await fs.writeFile(path.join(f.root,'index.md'),'# Test wiki\n<script>window.evil=true</script><a href="javascript:alert(1)">Unsafe</a>\n');
  passes(f.run());
  const html=await f.html();
  const data=JSON.parse(html.match(/<script type="application\/json" id="wiki-data">([\s\S]*?)<\/script>/)?.[1]||'null');
  // The source viewer intentionally retains raw Markdown; inspect rendered page HTML only.
  assert.ok(data,'embedded snapshot is present');
  assert.doesNotMatch(data.pages[0].html,/<script|javascript:/);
});

test('evidence is not treated as wiki content',async t=>{
  const f=await fixture(t,{'evidence/raw.md':'---\ninvalid metadata\n---\n# Raw capture\n'});
  passes(f.run());
  assert.match(f.run('--check').stdout,/1 pages/);
});
