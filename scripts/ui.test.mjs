import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {assemble,themes} from '../skills/fungi-ui/scripts/assemble.mjs';
test('each assembled workflow retains input and resolves its own schema against the shared kit',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ui-assembly-test-')),input=path.join(dir,'input.json');
 await writeFile(input,JSON.stringify({title:'Original'}));
 for(const [skill,entry] of [['grill-form','form.html'],['show-outcome','outcome.html']]){
  const bundle=await assemble({assets:new URL('../skills/'+skill+'/assets/',import.meta.url),entry,input});
  const page=await readFile(bundle.html,'utf8');
  for(const [,file] of page.matchAll(/(?:href|src)="([^":]+)"/g))await access(path.join(bundle.directory,file));
  const model=await import(pathToFileURL(path.join(bundle.directory,'workflow/assets/model.mjs')));
  assert.equal(typeof(model.normalizeSpec??model.normalizeInput),'function');
  await assert.rejects(access(path.join(bundle.directory,'workflow/assets/vendor')));
  await assert.rejects(access(path.join(bundle.directory,'workflow/assets/workflow')));
  await assert.rejects(access(path.join(bundle.directory,'workflow/assets/fungi-ui')));
  await writeFile(input,JSON.stringify({title:'Edited'}));
  assert.equal(JSON.parse(await readFile(bundle.input,'utf8')).title,'Original');
  await writeFile(input,JSON.stringify({title:'Original'}));
 }
});
test('a theme comes from the explicit option, then the personal setting, then the template default',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ui-theme-test-')),settings=path.join(dir,'settings.json');
 const options={assets:new URL('../skills/show-outcome/assets/',import.meta.url),entry:'outcome.html',settings};
 const tag=async bundle=>(await readFile(bundle.html,'utf8')).match(/<html\b[^>]*>/)[0];
 const fallback=await assemble(options);assert.equal(fallback.theme,'classic');assert.equal(await tag(fallback),'<html lang="en" data-theme="classic">');
 await writeFile(settings,JSON.stringify({theme:'paper'}));
 const personal=await assemble(options);assert.equal(personal.theme,'paper');assert.equal(await tag(personal),'<html lang="en" data-theme="paper">');
 assert.equal((await assemble({...options,theme:'paper-dark'})).theme,'paper-dark');
 await writeFile(settings,JSON.stringify({theme:'papyrus'}));
 await assert.rejects(assemble(options),/Unknown theme "papyrus"\. Available: classic, paper, paper-dark\./);
});
test('every theme is imported into the theme layer and every bundled font exists',async()=>{
 const assets=new URL('../skills/fungi-ui/assets/',import.meta.url),css=await readFile(new URL('ui.css',assets),'utf8');
 for(const name of (await themes()).slice(1))assert.ok(css.includes(`@import url(themes/${name}.css) layer(fungi-theme);`),name);
 for(const [,file] of (await readFile(new URL('fonts.css',assets),'utf8')).matchAll(/url\(([^)]+)\)/g))await access(new URL(file,assets));
});
