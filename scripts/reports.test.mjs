import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const checker=fileURLToPath(new URL('../skills/verify-change/scripts/check-reports.mjs',import.meta.url));
async function fixture(t,files={}) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'jstack-reports-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  for (const [name,content] of Object.entries(files)) {
    const target=path.join(root,name);
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.writeFile(target,content);
  }
  return {root,run:(...args)=>spawnSync(process.execPath,[checker,root,...args],{encoding:'utf8'})};
}
const report=result=>'---\nresult: '+result+'\n---\n# Report\n';

test('verification accepts its three outcomes and ignores unrelated page metadata',async t=>{
  const f=await fixture(t,{'verification/runs/a.md':report('Passed'),'verification/runs/b.md':report('Failed'),'verification/runs/c.md':report('Untested'),'catalog/item.md':report('In stock')});
  const result=f.run();assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{reports:3,errors:[]});
});

test('invalid, missing, and duplicate result metadata cannot pass report validation',async t=>{
  const f=await fixture(t,{'verification/runs/a.md':report('Green'),'verification/runs/b.md':'# No outcome\n','verification/runs/c.md':'---\nresult: Failed\nresult: Passed\n---\n# Conflicting\n'});
  const result=f.run();assert.equal(result.status,1);
  assert.equal(JSON.parse(result.stdout).errors.length,3);
});

test('custom report paths are supported without allowing directory escapes or symlinks',async t=>{
  const f=await fixture(t,{'checks/runs/one.md':report('Passed')});
  assert.equal(f.run('--runs-dir','checks/runs').status,0);
  assert.notEqual(f.run('--runs-dir','../outside').status,0);
  await fs.symlink(path.join(f.root,'checks'),path.join(f.root,'alias'));
  assert.notEqual(f.run('--runs-dir','alias/runs').status,0);
});

test('missing or empty report directories do not produce a misleading success',async t=>{
  const f=await fixture(t);
  assert.notEqual(f.run().status,0);
  await fs.mkdir(path.join(f.root,'verification/runs'),{recursive:true});
  const result=f.run();assert.notEqual(result.status,0);assert.match(result.stderr,/No reports found/);
});
