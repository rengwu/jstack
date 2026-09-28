import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const source=fileURLToPath(new URL('../skills/wiki/assets/_build.mjs',import.meta.url));
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

test('custom metadata renders generically on any page with escaped labels and values',async t=>{
  const f=await fixture(t,{'catalog/item.md':'---\nstatus: Available\nresult: In stock\nowner: <img src=x onerror=alert(1)>\nupdated: 2026-09-28\n---\n# Item\n'});
  passes(f.run());
  const data=JSON.parse((await f.html()).match(/<script type="application\/json" id="wiki-data">([\s\S]*?)<\/script>/)[1]);
  const page=data.pages.find(p=>p.id==='catalog/item');
  assert.equal(page.metadata.status,'Available');
  assert.equal(page.metadata.result,'In stock');
  assert.match(page.metadataHtml,/Status: Available/);
  assert.match(page.metadataHtml,/Result: In stock/);
  assert.match(page.metadataHtml,/&lt;img/);
  assert.doesNotMatch(page.metadataHtml,/<img/);
  assert.match(page.metadataHtml,/Last updated: 2026-09-28/);
});

test('missing attachments, invalid dates, and broken Markdown targets fail the build',async t=>{
  const f=await fixture(t,{'index.md':'# Test wiki\n[Evidence](evidence/missing.png)\n'});
  fails(f.run(),/Missing or symlinked attachment/);
  await fs.writeFile(path.join(f.root,'index.md'),'# Test wiki\n[Missing](missing.md)\n');
  fails(f.run(),/Broken link/);
  await fs.writeFile(path.join(f.root,'index.md'),'# Test wiki\n');
  await fs.mkdir(path.join(f.root,'verification/runs'),{recursive:true});
  await fs.writeFile(path.join(f.root,'verification/runs/one.md'),'---\nupdated: 2026-02-30\n---\n# Run\n');
  fails(f.run(),/Invalid updated date/);
});

test('attachments cannot escape evidence, follow symlinks, or link executable HTML',async t=>{
  const f=await fixture(t,{'outside.txt':'outside','evidence/one.txt':'inside','evidence/page.html':'<script>alert(1)</script>'});
  for (const href of ['outside.txt','../outside.txt','%2Fetc/passwd','evidence/page.html']) {
    await fs.writeFile(path.join(f.root,'index.md'),'# Test wiki\n[Bad]('+href+')\n');
    fails(f.run(),/Unsupported attachment|relative link/);
  }
  await fs.symlink(path.join(f.root,'outside.txt'),path.join(f.root,'evidence/link.txt'));
  await fs.writeFile(path.join(f.root,'index.md'),'# Test wiki\n[Bad](evidence/link.txt)\n');
  fails(f.run(),/symlinked attachment/);
  await fs.symlink(f.root,path.join(f.root,'evidence/linked-dir'));
  await fs.writeFile(path.join(f.root,'index.md'),'# Test wiki\n[Bad](evidence/linked-dir/outside.txt)\n');
  fails(f.run(),/symlinked attachment/);
});

test('a duplicate attachment cannot bypass fragment validation',async t=>{
  const f=await fixture(t,{'index.md':'# Test wiki\n[One](evidence/a.txt)\n[Two](evidence/a.txt#fragment)\n','evidence/a.txt':'text'});
  fails(f.run(),/Unsupported attachment/);
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

test('generic attachments directory works without a planning or verification page',async t=>{
  const f=await fixture(t,{'index.md':'# Test wiki\n[Manual](attachments/manual.txt)\n','attachments/manual.txt':'reference material','attachments/raw.md':'---\ninvalid metadata\n---\n'});
  passes(f.run());passes(f.run('--check'));
  const data=JSON.parse((await f.html()).match(/<script type="application\/json" id="wiki-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.pages.length,1);
  assert.equal(data.pages[0].attachments[0].path,'attachments/manual.txt');
  assert.equal(data.pages[0].metadataHtml,'');
});
