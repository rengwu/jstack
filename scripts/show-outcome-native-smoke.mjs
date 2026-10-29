import {assemble} from '../skills/fungi-ui/scripts/assemble.mjs';
// Bounded synthetic native checks; never answers a human session.
import {mkdtemp,cp,readFile,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const binary=path.resolve(process.argv[2]??path.join(os.homedir(),'.fungi/bin/fungi'));
const directory=await mkdtemp(path.join(os.tmpdir(),'fungi-outcome-smoke-'));
const {directory:assets}=await assemble({assets:new URL('../skills/show-outcome/assets/',import.meta.url),entry:'outcome.html',theme:'classic'});
const html=await readFile(path.join(assets,'outcome.html'),'utf8');
await writeFile(path.join(assets,'outcome.html'),html.replace('</body>','<script type="module" src="fixture.mjs"></script></body>'));
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9kAAAAASUVORK5CYII=';
await writeFile(path.join(assets,'fixture.mjs'),String.raw`
const until=async condition=>{
 const end=Date.now()+12000;
 while(Date.now()<end){if(condition())return;await new Promise(r=>setTimeout(r,25));}
 throw new Error('Fixture timed out: '+document.getElementById('message').textContent);
};
const check=(condition,message)=>{if(!condition)throw new Error(message)};
const write=(node,text)=>{node.focus();node.textContent=text;node.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));};
try{
 const ready=await fungi.ready();
 if(['invalid','questions'].includes(ready.input.testCase)){
  await until(()=>document.getElementById('message')&&!document.getElementById('message').hidden);
  check(document.getElementById('submit').disabled,'Invalid input can submit');
  await fungi.submit({fixture:ready.input.testCase,message:document.getElementById('message').textContent});
 }else{
  await until(()=>document.getElementById('outcome-report'));
  await until(()=>document.querySelector('.diagram')?.dataset.renderState==='ready');
  const report=document.getElementById('outcome-report');
  await until(()=>getComputedStyle(document.body).backgroundColor==='rgb(22, 21, 19)');
  check(report.querySelector('table'),'Markdown table missing');
  check(!report.querySelector('script'),'Raw HTML executed');
  check(report.textContent.includes('not implemented'),'Caveat missing');
  await until(()=>report.querySelector('img')?.naturalWidth===1);
  const notes=document.getElementById('notes');
  check(notes,'Always-present Notes missing');
  {
   const steps=[...document.querySelectorAll('#next-step-options input')];
   check(document.getElementById('next-steps').hidden===!ready.input.nextSteps?.length,'Next-step visibility does not match input');
   if(ready.input.testCase==='steps'){
    check(document.querySelectorAll('.choice-badge').length===1&&document.querySelector('.choice-badge').textContent.trim()==='Recommended','Recommendation marker missing');
    check(document.querySelector('.choice-recommendation')?.textContent===ready.input.nextSteps[0].recommendation,'Recommendation reason missing');
    if(!ready.draft){
     check(steps.length===3&&steps.every(step=>!step.checked),'Next steps must start unchecked');
     check(document.getElementById('submit').disabled,'Blank report permits acknowledgment');
     steps[0].click();steps[2].click();
     check(notes.textContent===''&&!document.getElementById('submit').disabled,'Selection alone cannot submit');
     await until(()=>document.getElementById('draft-message').textContent==='Draft saved');
     document.getElementById('cancel').click();
    }else{
     check(steps[0].checked&&!steps[1].checked&&steps[2].checked,'Selected steps did not restore');
     check(notes.textContent==='','Selection-only draft gained Notes');
     await until(()=>!document.getElementById('submit').disabled);
     document.getElementById('submit').click();
    }
   }else if(!ready.draft){
    check(document.getElementById('submit').disabled,'Blank report permits acknowledgment');
    await new Promise(r=>setTimeout(r,500));
    write(notes,'Native optional note ');
    const selection=getSelection(),range=document.createRange();range.selectNodeContents(notes);range.collapse(false);selection.removeAllRanges();selection.addRange(range);
    const bytes=Uint8Array.from(atob(ready.input.fixturePng.split(',')[1]),c=>c.charCodeAt(0));
    const transfer=new DataTransfer();transfer.items.add(new File([bytes],'fixture.png',{type:'image/png'}));
    notes.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true}));
    await until(()=>document.querySelector('.image-chip'));
    await until(()=>document.getElementById('draft-message').textContent==='Draft saved');
    check(document.getElementById('cancel').textContent==='Close','Report close label missing');
    document.getElementById('cancel').click();
   }else{
    check(notes.textContent.includes('Native optional note')&&document.querySelector('.image-chip'),'Notes draft not restored');
    await until(()=>!document.getElementById('submit').disabled);
    document.getElementById('submit').click();
   }
  }
 }
}catch(error){await fungi.submit({fixtureError:error.message});}
`);
const env={...process.env,FUNGI_STATE_DIR:path.join(directory,'sessions')};
delete env.CODEX_THREAD_ID;
const run=async args=>JSON.parse((await promisify(execFile)(binary,args,{env,timeout:25000,maxBuffer:4*1024*1024})).stdout);
const base={schema:'outcome/v1',id:'native-report',projectName:'Disposable native check',title:'Synthetic outcome — not project decisions',
 markdown:'Recorded, **not implemented**.\n\n| Choice | Result |\n| --- | --- |\n| Layout | Wider |\n\n```mermaid\nflowchart LR\n A --> B\n```\n\n![Fixture pixel]('+png+')\n\n<script>throw new Error("must not execute")</script>',fixturePng:png};
const open=async input=>{
 const file=path.join(directory,input.testCase+'.json');await writeFile(file,JSON.stringify(input));
 return run(['open',path.join(assets,'outcome.html'),'--input',file,'--delivery','wait']);
};
const evidence={binary,directory,version:await run(['version']),doctor:await run(['doctor'])};
try{
 evidence.reportClosed=await open({...base,testCase:'report'});
 assert.equal(evidence.reportClosed.outcome,'cancelled',JSON.stringify(evidence.reportClosed));
 evidence.reportSubmitted=await run(['reopen',evidence.reportClosed.session,'--delivery','wait']);
 const report=evidence.reportSubmitted;
 assert.equal(report.data.schema,'outcome/v1',JSON.stringify(report));assert.equal(report.data.outcomeId,base.id);
 assert.match(report.data.answers[0].notes,/Native optional note.*\[Image #1\]/);
 assert.equal(report.artifacts.length,1);
 const image=report.artifacts[0];assert.equal(image.key,'image-1');
 assert.equal(createHash('sha256').update(await readFile(image.path)).digest('hex'),image.sha256);
 const nextSteps=[{id:'scope',label:'Decide import scope',recommendation:'Set the boundary before designing the import flow.'},{id:'snapping',label:'Set slider snapping'},{id:'chips',label:'Review reply chips'}];
 evidence.stepsClosed=await open({...base,testCase:'steps',nextSteps});
 assert.equal(evidence.stepsClosed.outcome,'cancelled',JSON.stringify(evidence.stepsClosed));
 evidence.stepsSubmitted=await run(['reopen',evidence.stepsClosed.session,'--delivery','wait']);
 const steps=evidence.stepsSubmitted;
 assert.equal(steps.outcome,'submitted');assert.equal(steps.data.schema,'outcome/v1',JSON.stringify(steps));
 assert.deepEqual(steps.data.selectedNextSteps,[nextSteps[0],nextSteps[2]]);
 assert.equal(steps.data.answers[0].notes,'');assert.equal(steps.artifacts.length,0);
 evidence.questions=await open({...base,testCase:'questions',questions:[{prompt:'Old combined input'}]});
 assert.equal(evidence.questions.data.fixture,'questions');assert.match(evidence.questions.data.message,/separate session/);
 evidence.invalid=await open({...base,schema:'outcome/v999',testCase:'invalid'});
 assert.equal(evidence.invalid.data.fixture,'invalid');assert.match(evidence.invalid.data.message,/schema/);
 evidence.result='Passed';
}catch(error){evidence.result='Failed';evidence.error=error.message;process.exitCode=1;}
await writeFile(path.join(directory,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
if(process.argv[3]){await mkdir(path.dirname(path.resolve(process.argv[3])),{recursive:true});await writeFile(process.argv[3],JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify({result:evidence.result,evidence:path.join(directory,'evidence.json'),error:evidence.error}));
