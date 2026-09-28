#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const usage='Usage: node check-reports.mjs <wiki-directory> [--runs-dir <relative-directory>]';
const outcomes=new Set(['Passed','Failed','Untested']);

async function reports(dir) {
  const result=[];
  for (const entry of await fs.readdir(dir,{withFileTypes:true})) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const file=path.join(dir,entry.name);
    if (entry.isDirectory()) result.push(...await reports(file));
    else if (entry.isFile() && /\.md$/i.test(entry.name)) result.push(file);
  }
  return result.sort();
}

async function main() {
  const args=process.argv.slice(2);
  if (args.length===1 && args[0]==='--help') {console.log(usage);return;}
  if (!(args.length===1 || (args.length===3 && args[1]==='--runs-dir')) || args[0].startsWith('-')) throw new Error(usage);
  const root=path.resolve(args[0]);
  const relative=args[2]||'verification/runs';
  if (!relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(part=>!part || part.startsWith('.'))) throw new Error('Report directory must be a relative, non-hidden directory inside the wiki.');
  let directory=root;
  for (const part of relative.split('/')) {
    directory=path.join(directory,part);
    const stat=await fs.lstat(directory).catch(()=>null);
    if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Report directory is missing, not a directory, or symlinked.');
  }
  const files=await reports(directory);
  if (!files.length) throw new Error('No reports found; no verification outcome was checked.');
  const errors=[];
  for (const file of files) {
    const source=(await fs.readFile(file,'utf8')).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
    const match=source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
    const fields=Object.create(null);
    let invalid=false;
    for (const line of (match?.[1]||'').split('\n')) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const colon=line.indexOf(':');
      const key=line.slice(0,colon).trim();
      if (colon<1 || Object.hasOwn(fields,key)) {invalid=true;break;}
      fields[key]=line.slice(colon+1).trim();
    }
    const name=path.relative(root,file).split(path.sep).join('/');
    if (!match || invalid) errors.push({file:name,error:'Missing or malformed flat frontmatter.'});
    else if (!outcomes.has(fields.result)) errors.push({file:name,error:'Report result must be Passed, Failed, or Untested.'});
  }
  console.log(JSON.stringify({reports:files.length,errors},null,2));
  if (errors.length) process.exitCode=1;
}

await main().catch(error=>{console.error(error.message);process.exitCode=1;});
