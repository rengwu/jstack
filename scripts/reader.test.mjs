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

test('nested inline images use validated attachments and detect content changes',async t=>{
  const f=await fixture(t,{
    'archive/topic.md':'# Topic\n![A <view> & details](../attachments/a%20%23%20b.png "Screenshot")\n',
    'attachments/a # b.png':Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=','base64')
  });
  passes(f.run());passes(f.run('--check'));
  const html=await f.html();
  const data=JSON.parse(html.match(/<script type="application\/json" id="wiki-data">([\s\S]*?)<\/script>/)[1]);
  const page=data.pages.find(p=>p.id==='archive/topic');
  assert.match(page.html,/<img src="attachments\/a%20%23%20b.png" alt="A &lt;view&gt; &amp; details" title="Screenshot"/);
  assert.equal(page.attachments.length,1);
  assert.match(html,/img-src 'self' file:/);
  assert.match(html,/article img\{[^}]*max-width:100%;height:auto/);
  await fs.appendFile(path.join(f.root,'attachments/a # b.png'),Buffer.from([0]));
  fails(f.run('--check'),/stale/);
});

test('images reject remote, missing, non-image and escaping paths including duplicate fragments',async t=>{
  const f=await fixture(t,{'evidence/a.png':'fixture','evidence/a.svg':'<svg/>','evidence/a.txt':'text','outside.png':'outside'});
  for (const href of ['https://example.com/a.png','//example.com/a.png','data:image/png;base64,AA==','evidence/missing.png','evidence/a.svg','evidence/a.txt','outside.png','../outside.png','%2Fetc/a.png','evidence/a.png#fragment']) {
    await fs.writeFile(path.join(f.root,'index.md'),'# Test wiki\n[Already linked](evidence/a.png)\n![Bad]('+href+')\n');
    fails(f.run(),/Unsupported|Missing|relative link/);
  }
  await fs.symlink(path.join(f.root,'outside.png'),path.join(f.root,'evidence/link.png'));
  await fs.writeFile(path.join(f.root,'index.md'),'# Test wiki\n![Bad](evidence/link.png)\n');
  fails(f.run(),/symlinked attachment/);
});

test('raw HTML cannot bypass image validation or inject executable attributes',async t=>{
  const f=await fixture(t,{'index.md':'# Test wiki\n![Valid](evidence/a.png)\n\n<script>window.evil=true</script><a href="javascript:alert(1)">Unsafe</a><img src="https://example.com/tracker.png"><img src="../outside.png"><img src="evidence/unvalidated.png"><img src="evidence/a.png" onerror="alert(1)" srcset="https://example.com/a.png 2x">\n','evidence/a.png':'fixture'});
  passes(f.run());
  const html=await f.html();
  const data=JSON.parse(html.match(/<script type="application\/json" id="wiki-data">([\s\S]*?)<\/script>/)?.[1]||'null');
  // The source viewer intentionally retains raw Markdown; inspect rendered page HTML only.
  assert.ok(data,'embedded snapshot is present');
  assert.doesNotMatch(data.pages[0].html,/<script|javascript:|onerror|srcset|example\.com|outside\.png|unvalidated\.png/);
  assert.match(data.pages[0].html,/<img src="evidence\/a.png"/);
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
