import {assemble} from '../skills/fungi-ui/scripts/assemble.mjs';
// Disposable fixture only. Drives the actual prepared page and public bridge.
// A bounded machine check, never a waiter or fake answer in a human interview.
import {mkdtemp,cp,readFile,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const binary=path.resolve(process.argv[2]??path.join(os.homedir(),'.fungi/bin/fungi'));
const directory=await mkdtemp(path.join(os.tmpdir(),'fungi-grill-smoke-'));
const {directory:assets}=await assemble({assets:new URL('../skills/grill-form/assets/',import.meta.url),entry:'form.html',theme:'classic'});
let html=await readFile(path.join(assets,'form.html'),'utf8');
await writeFile(path.join(assets,'form.html'),html.replace('</body>','<script type="module" src="fixture.mjs"></script></body>'));
await writeFile(path.join(assets,'fixture.mjs'),String.raw`
const until=async condition=>{
 const end=Date.now()+12000;
 while(Date.now()<end){if(condition())return;await new Promise(r=>setTimeout(r,25));}
 throw new Error('Fixture timed out: '+document.getElementById('message').textContent);
};
try{
 const ready=await fungi.ready();
 await until(()=>document.querySelectorAll('fieldset').length===4);
 await until(()=>document.querySelector('.diagram')?.dataset.renderState==='ready');
 const editor=document.querySelectorAll('.notes-editor')[1];
 if(!ready.draft){
  document.querySelector('input[name="choice"]').click();
  await new Promise(r=>setTimeout(r,300));
  document.querySelector('.comment-toggle').click();
  const surface=document.querySelector('.comment-surface');
  surface.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  surface.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await until(()=>document.querySelector('.comment-dialog[open] .notes-editor'));
  const comment=document.querySelector('.comment-dialog .notes-editor');comment.textContent='Native region comment';comment.dispatchEvent(new InputEvent('input',{bubbles:true}));
  document.querySelector('.save-comment').click();
  await until(()=>!document.querySelector('.comment-dialog'));
  document.querySelector('.prototype').contentWindow.postMessage('fixture-final','*');
  editor.focus();editor.textContent='Native smoke ';
  editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'Native smoke '}));
  const selection=getSelection(),range=document.createRange();range.selectNodeContents(editor);range.collapse(false);selection.removeAllRanges();selection.addRange(range);
  const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9kAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  const transfer=new DataTransfer();transfer.items.add(new File([bytes],'fixture.png',{type:'image/png'}));
  editor.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true}));
  await until(()=>editor.querySelector('.image-chip'));
  await until(()=>document.getElementById('draft-message').textContent==='Draft saved');
  document.getElementById('cancel').click();
 }else{
  if(!document.querySelector('input[name="choice"]:checked')||!editor.textContent.includes('Native smoke')||!editor.querySelector('.image-chip'))throw new Error('Draft was not restored to controls');
  await until(()=>!document.getElementById('submit').disabled);
  document.getElementById('submit').click();
 }
}catch(error){await fungi.submit({fixtureError:error.message});}
`);
const input={projectName:'Disposable native check',title:'Synthetic fixture — not project decisions',questions:[
 {id:'choice',prompt:'Fixture choice',options:['First','Second'],required:true},
 {id:'notes',prompt:'Fixture notes and PNG'},
 {id:'preview',prompt:'Fixture diagram and preview',context:'```mermaid\nflowchart LR\n A --> B\n```',preview:{state:{size:16},html:'<p>Fixture preview</p><script>setTimeout(()=>{if(grill.state.size===16)grill.setState({size:20})},100);addEventListener("message",e=>{if(e.data==="fixture-final")grill.setState({size:22})})</script>'}},
 {id:'untouched',prompt:'Leave blank'}
]};
await writeFile(path.join(directory,'input.json'),JSON.stringify(input));
const env={...process.env,FUNGI_STATE_DIR:path.join(directory,'sessions')};
delete env.CODEX_THREAD_ID;
const run=async args=>JSON.parse((await promisify(execFile)(binary,args,{env,timeout:25000,maxBuffer:4*1024*1024})).stdout);
const evidence={binary,directory,version:await run(['version']),doctor:await run(['doctor'])};
try{
 evidence.cancelled=await run(['open',path.join(assets,'form.html'),'--input',path.join(directory,'input.json'),'--delivery','wait']);
 assert.equal(evidence.cancelled.outcome,'cancelled',JSON.stringify(evidence.cancelled));
 evidence.submitted=await run(['reopen',evidence.cancelled.session,'--delivery','wait']);
 const result=evidence.submitted;
 assert.equal(result.outcome,'submitted');assert.equal(result.data.schema,'grill-form/v1',JSON.stringify(result));
 assert.equal(result.data.answers[0].choice,'First');
 assert.match(result.data.answers[1].notes,/Native smoke.*\[Image #1\]/);
 assert.deepEqual(result.data.answers[2].states.main,{size:22});
 assert.equal(result.data.answers[2].comments[0].notes,'Native region comment');
 assert.deepEqual(result.data.answers[2].comments[0].state,{size:20});
 assert.ok(result.data.answers[2].comments[0].region.width>=4);
 assert.equal(result.data.answers[3].status,'untouched');
 assert.equal(result.artifacts.length,1);
 const bytes=await readFile(result.artifacts[0].path);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),result.artifacts[0].sha256);
 assert.equal(result.artifacts[0].key,'image-1');
 evidence.result='Passed';
}catch(error){evidence.result='Failed';evidence.error=error.message;process.exitCode=1;}
await writeFile(path.join(directory,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
if(process.argv[3]){await mkdir(path.dirname(path.resolve(process.argv[3])),{recursive:true});await writeFile(process.argv[3],JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify({result:evidence.result,evidence:path.join(directory,'evidence.json'),error:evidence.error}));
