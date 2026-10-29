import {assemble,themes} from '../skills/fungi-ui/scripts/assemble.mjs';
// Bounded synthetic native check: each theme's outcome page loads its tokens and bundled fonts in Fungi's WebView.
// The injected fixture submits its own measurements; it never answers a human session.
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const binary=path.resolve(process.argv[2]??path.join(os.homedir(),'.fungi/bin/fungi'));
const output=process.argv[3];
if(!output)throw new Error('Usage: node scripts/ui-theme-native-smoke.mjs FUNGI_BINARY OUTPUT_JSON');
const directory=await mkdtemp(path.join(os.tmpdir(),'fungi-theme-smoke-'));
const env={...process.env,FUNGI_STATE_DIR:path.join(directory,'sessions')};
delete env.CODEX_THREAD_ID;
const run=async args=>JSON.parse((await promisify(execFile)(binary,args,{env,timeout:25000,maxBuffer:4*1024*1024})).stdout);
const fixture=String.raw`
const until=async condition=>{const end=Date.now()+12000;while(Date.now()<end){if(condition())return;await new Promise(r=>setTimeout(r,25));}throw new Error('Fixture timed out');};
try{
 await until(()=>document.querySelector('.diagram')?.dataset.renderState==='ready');
 await document.fonts.ready;
 const token=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
 await fungi.submit({fixture:'theme',theme:document.documentElement.dataset.theme,background:getComputedStyle(document.body).backgroundColor,bgToken:token('--ui-bg'),bodyFont:getComputedStyle(document.body).fontFamily,
  fonts:[...new Set([...document.fonts].map(font=>font.family.replace(/"/g,'')+' '+font.status))].sort(),userAgent:navigator.userAgent});
}catch(error){await fungi.submit({fixture:'theme',error:error.message});}
`;
const input={schema:'outcome/v1',id:'native-theme',title:'Native theme check',markdown:'Body text, `code` and a diagram.\n\n```mermaid\nflowchart LR\n A --> B\n```'};
const evidence={binary,directory,version:await run(['version']),results:[]};
for(const theme of await themes()){
 const {directory:assets}=await assemble({assets:new URL('../skills/show-outcome/assets/',import.meta.url),entry:'outcome.html',theme});
 const html=await readFile(path.join(assets,'outcome.html'),'utf8');
 await writeFile(path.join(assets,'outcome.html'),html.replace('</body>','<script type="module" src="fixture.mjs"></script></body>'));
 await writeFile(path.join(assets,'fixture.mjs'),fixture);
 const file=path.join(assets,'input.json');await writeFile(file,JSON.stringify(input));
 const result=await run(['open',path.join(assets,'outcome.html'),'--input',file,'--delivery','wait']);
 const data=result.data??{};
 const loaded=(data.fonts??[]).filter(font=>font.endsWith(' loaded'));
 const failures=[...(result.outcome==='submitted'?[]:['outcome '+result.outcome]),...(data.error?[data.error]:[]),...(data.theme===theme?[]:['data-theme '+data.theme]),...(loaded.length?[]:['no bundled font loaded'])];
 evidence.results.push({theme,session:result.session,...data,failures});
}
evidence.result=evidence.results.some(result=>result.failures.length)?'Failed':'Passed';
if(evidence.result==='Failed')process.exitCode=1;
await writeFile(output,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({result:evidence.result,failures:evidence.results.flatMap(r=>r.failures.map(f=>r.theme+': '+f))}));
