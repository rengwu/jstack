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
 await until(()=>document.querySelectorAll('fieldset').length===12);
 await until(()=>document.querySelector('.diagram')?.dataset.renderState==='ready');
 const editor=document.querySelectorAll('.notes-editor')[1];
 const check=(condition,message)=>{if(!condition)throw new Error(message)};
 const multi=[...document.querySelectorAll('input[name="many"]')];
 check(multi.length===16&&multi.every(input=>input.type==='checkbox'),'Multiple choices must render checkboxes');
 const multiField=multi[0].closest('fieldset');

 if(!ready.draft){
  check(multi.every(input=>!input.checked),'Selections must start empty');
  multi[0].click();multi[1].closest('label').querySelector('.choice-copy').click();
  check(multi[0].checked&&multi[1].checked,'Two choices did not remain selected');
  multi[0].closest('.choice-card').click();
  check(!multi[0].checked&&multi[1].checked,'Card did not toggle exactly once');
  multiField.querySelector('.clear-selection').click();
  check(multi.every(input=>!input.checked),'Clear did not remove all choices');
  multi[0].click();multi[14].click();multi[15].click();
  document.getElementById('notes-many').textContent='Another proposal';
  document.getElementById('notes-many').dispatchEvent(new InputEvent('input',{bubbles:true}));
  const singles=[...document.querySelectorAll('input[name="choice"]')];
  singles[1].click();singles[0].click();
  check(singles[0].checked&&!singles[1].checked,'Single selection changed behavior');
  await new Promise(r=>setTimeout(r,300));
  document.querySelector('.comment-toggle').click();
  const surface=document.querySelector('.comment-surface');
  surface.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  surface.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await until(()=>document.querySelector('.comment-dialog[open] .notes-editor'));
  const comment=document.querySelector('.comment-dialog .notes-editor');comment.textContent='Native region comment';comment.dispatchEvent(new InputEvent('input',{bubbles:true}));
  document.querySelector('.save-comment').click();
  await until(()=>!document.querySelector('.comment-dialog'));
  for(let index=2;index<=21;index++){
   document.querySelector('.comment-toggle').click();
   surface.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
   surface.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
   await until(()=>document.querySelector('.comment-dialog[open] .notes-editor'));
   const note=document.querySelector('.comment-dialog .notes-editor');
   note.textContent=index===21?'Long comment '+ 'x'.repeat(13000):'Native comment '+index;
   note.dispatchEvent(new InputEvent('input',{bubbles:true}));
   check(!document.querySelector('.save-comment').disabled,'Comment length still capped');
   document.querySelector('.save-comment').click();
   await until(()=>!document.querySelector('.comment-dialog'));
  }
  document.querySelector('.prototype').contentWindow.postMessage('fixture-final','*');
  editor.focus();editor.textContent='Native smoke '+ 'x'.repeat(13000)+' ';
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
  check(multi[0].checked&&multi[14].checked&&multi[15].checked&&multi.filter(input=>input.checked).length===3,'Multiple choices did not restore');
  check(editor.textContent.length>13000,'Long notes were truncated');
  check(document.querySelectorAll('.comment-summary').length===21,'Comments did not restore');
  await until(()=>!document.getElementById('submit').disabled);
  document.getElementById('submit').click();
 }
}catch(error){await fungi.submit({fixtureError:error.message});}
`);
const input={projectName:'Disposable native check',title:'Synthetic fixture — not project decisions',questions:[
 {id:'choice',prompt:'Fixture choice',options:['First','Second'],required:true},
 {id:'notes',prompt:'Fixture notes and PNG'},
 {id:'preview',prompt:'Fixture diagram and preview',context:'```mermaid\nflowchart LR\n A --> B\n```',preview:{state:{size:16},html:'<p>Fixture preview</p><script>setTimeout(()=>{if(grill.state.size===16)grill.setState({size:20})},100);addEventListener("message",e=>{if(e.data==="fixture-final")grill.setState({size:22,text:"x".repeat(13000)})})</script>'}},
 {id:'untouched',prompt:'Leave blank'},
 {id:'many',prompt:'Choose several proposals',selection:'multiple',options:Array.from({length:15},(_,i)=>({id:'proposal'+(i+1),label:'Proposal '+(i+1),...(i<2?{preview:{height:80,html:'<button>Proposal preview</button>'}}:{})}))},
 ...Array.from({length:7},(_,i)=>({id:'extra'+i,prompt:'Additional review '+(i+1)}))
]};
await writeFile(path.join(directory,'input.json'),JSON.stringify(input));
const env={...process.env,FUNGI_STATE_DIR:path.join(directory,'sessions')};
delete env.CODEX_THREAD_ID;
const run=async args=>JSON.parse((await promisify(execFile)(binary,args,{env,timeout:45000,maxBuffer:4*1024*1024})).stdout);
const evidence={binary,directory,version:await run(['version']),doctor:await run(['doctor'])};
try{
 evidence.cancelled=await run(['open',path.join(assets,'form.html'),'--input',path.join(directory,'input.json'),'--delivery','wait']);
 assert.equal(evidence.cancelled.outcome,'cancelled',JSON.stringify(evidence.cancelled));
 evidence.submitted=await run(['reopen',evidence.cancelled.session,'--delivery','wait']);
 const result=evidence.submitted;
 assert.equal(result.outcome,'submitted');assert.equal(result.data.schema,'grill-form/v2',JSON.stringify(result));
 assert.deepEqual(result.data.answers[0].choices,['First']);
 assert.match(result.data.answers[1].notes,/Native smoke.*\[Image #1\]/);
 assert.deepEqual(result.data.answers[2].states.main,{size:22,text:'x'.repeat(13000)});
 assert.equal(result.data.answers[2].comments[0].notes,'Native region comment');
 assert.deepEqual(result.data.answers[2].comments[0].state,{size:20});
 assert.ok(result.data.answers[2].comments[0].region.width>=4);
 assert.equal(result.data.answers[3].status,'untouched');
 assert.equal(result.data.answers.length,12);
 assert.equal(result.data.answers[2].comments.length,21);
 assert.ok(result.data.answers[2].comments[20].notes.length>13000);
 assert.deepEqual(result.data.answers[4].choiceIds,['proposal1','proposal15','other']);
 assert.deepEqual(result.data.answers[4].choices,['Proposal 1','Proposal 15','Something else']);
 assert.equal(result.artifacts.length,1);
 const bytes=await readFile(result.artifacts[0].path);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),result.artifacts[0].sha256);
 assert.equal(result.artifacts[0].key,'image-1');
 evidence.result='Passed';
}catch(error){evidence.result='Failed';evidence.error=error.message;process.exitCode=1;}
await writeFile(path.join(directory,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
if(process.argv[3]){await mkdir(path.dirname(path.resolve(process.argv[3])),{recursive:true});await writeFile(process.argv[3],JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify({result:evidence.result,evidence:path.join(directory,'evidence.json'),error:evidence.error}));
