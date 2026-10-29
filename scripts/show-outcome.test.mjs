import {assemble} from '../skills/fungi-ui/scripts/assemble.mjs';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {normalizeInput,snapshot,restoreDraft,NOTES_ID} from '../skills/show-outcome/assets/model.mjs';
const limits={jsonBytes:1048576,artifactBytes:20971520,totalArtifactBytes:104857600};
const input={schema:'outcome/v1',id:'round-7',title:'Recorded, not implemented',markdown:'**Recorded.**\n\nA proposal remains open.'};
const spec=normalizeInput(input);
const png=new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9kAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],{type:'image/png'});

test('report has optional Notes and no silent acknowledgment submission',()=>{
 assert.throws(()=>snapshot(spec,'',new Map(),limits,true),/feedback/);
 const data=snapshot(spec,'Please revise the margin.',new Map(),limits,true).data;
 assert.equal(data.schema,'outcome/v1');assert.equal(data.outcomeId,'round-7');
 assert.equal(data.answers.length,1);assert.equal(data.answers[0].questionId,NOTES_ID);
 assert.equal(data.answers[0].notes,'Please revise the margin.');
 assert.equal(snapshot(spec,'',new Map(),limits).data.answers[0].status,'untouched');
});

test('next steps allow explicit multiple selections without Notes, and clear back to no feedback',()=>{
 const actions=normalizeInput({...input,nextSteps:[{id:'scope',label:'Decide import scope',selected:true},{id:'snapping',label:'Set slider snapping'},{id:'chips',label:'Review reply chips'}]});
 assert.deepEqual(restoreDraft(null,[],actions,limits).selectedIds,[]);
 assert.deepEqual(snapshot(actions,'',new Map(),limits).data.selectedNextSteps,[]);
 const data=snapshot(actions,'',new Map(),limits,true,['chips','scope']).data;
 assert.deepEqual(data.selectedNextSteps,[{id:'scope',label:'Decide import scope'},{id:'chips',label:'Review reply chips'}]);
 assert.equal(data.answers[0].notes,'');assert.equal(data.answers[0].status,'untouched');
 assert.throws(()=>snapshot(actions,'',new Map(),limits,true,[]),/feedback/);
 assert.throws(()=>snapshot(actions,'',new Map(),limits,true,['invented']),/from this outcome/);
 assert.throws(()=>snapshot(actions,'',new Map(),limits,true,['scope','scope']),/from this outcome/);
});

test('selected actions restore alongside Notes and images; earlier report drafts remain readable',()=>{
 const actions=normalizeInput({...input,nextSteps:[{id:'review',label:'Review the layout'}]});
 const saved=snapshot(actions,'See [Image #1]',new Map([[1,png]]),limits,true,['review']);
 const restored=restoreDraft(saved.data,saved.attachments,actions,limits);
 assert.deepEqual(restored.selectedIds,['review']);assert.equal(restored.notes,'See [Image #1]');assert.equal(restored.images.get(1),png);
 const legacy=structuredClone(saved.data);delete legacy.selectedNextSteps;
 assert.deepEqual(restoreDraft(legacy,saved.attachments,actions,limits).selectedIds,[]);
 const changed=structuredClone(saved.data);changed.selectedNextSteps[0].label='A different action';
 assert.throws(()=>restoreDraft(changed,saved.attachments,actions,limits),/do not match/);
 assert.throws(()=>restoreDraft({...saved.data,selectedNextSteps:null},saved.attachments,actions,limits),/do not match/);
});

test('recommendations preserve their reason through selection and drafts without selecting by default',()=>{
 const actions=normalizeInput({...input,nextSteps:[{id:'scope',label:'Settle the scope',recommendation:'  Unblocks the prototype.  '},{id:'prototype',label:'Build the prototype'}]});
 assert.deepEqual(restoreDraft(null,[],actions,limits).selectedIds,[]);
 assert.throws(()=>snapshot(actions,'',new Map(),limits,true),/feedback/);
 const saved=snapshot(actions,'',new Map(),limits,true,['scope']);
 assert.deepEqual(saved.data.selectedNextSteps,[{id:'scope',label:'Settle the scope',recommendation:'Unblocks the prototype.'}]);
 assert.deepEqual(restoreDraft(saved.data,[],actions,limits).selectedIds,['scope']);
 const legacy=structuredClone(saved.data);delete legacy.selectedNextSteps[0].recommendation;
 assert.deepEqual(restoreDraft(legacy,[],actions,limits).selectedIds,['scope']);
 assert.deepEqual(snapshot(actions,'',new Map(),limits,true,['prototype']).data.selectedNextSteps,[{id:'prototype',label:'Build the prototype'}]);
 for(const recommendation of [null,true,42,' ','x'.repeat(1001)]){
  assert.throws(()=>normalizeInput({...input,nextSteps:[{id:'scope',label:'Settle the scope',recommendation}]}),/reason/);
 }
});

test('next-step input rejects malformed or ambiguous choices',()=>{
 assert.throws(()=>normalizeInput({...input,nextSteps:null}),/list/);
 assert.throws(()=>normalizeInput({...input,nextSteps:[{id:'same',label:'One'},{id:'same',label:'Two'}]}),/unique/);
 assert.throws(()=>normalizeInput({...input,nextSteps:[{id:'../outside',label:'One'}]}),/valid ids/);
 assert.throws(()=>normalizeInput({...input,nextSteps:[{id:'empty',label:' '}]}),/label/);
 assert.deepEqual(normalizeInput(input).nextSteps,[]);
});

test('combined questions are rejected explicitly instead of discarded',()=>{
 assert.throws(()=>normalizeInput({...input,questions:[{prompt:'A question'}]}),/separate session/);
 assert.throws(()=>normalizeInput({...input,questions:null}),/separate session/);
 assert.equal(normalizeInput({...input,questions:[]}).id,input.id);
});

test('inline image references and drafts round-trip; deleting a reference removes its attachment',()=>{
 const images=new Map([[1,png]]),notes='See [Image #1] here';
 const saved=snapshot(spec,notes,images,limits,true);
 assert.equal(saved.attachments[0].key,'image-1');assert.equal(saved.data.answers[0].images[0].offset,4);
 const restored=restoreDraft(saved.data,saved.attachments,spec,limits);
 assert.equal(restored.notes,notes);assert.equal(restored.images.get(1),png);
 assert.equal(snapshot(spec,'No image needed',images,limits,true).attachments.length,0);
 assert.equal(snapshot(spec,'[Image #1] again [Image #1]',images,limits,true).attachments.length,1);
 assert.throws(()=>restoreDraft(saved.data,[],spec,limits),/missing/);
});

test('draft recovery rejects another report, wrong format, mixed answers and broken image references',()=>{
 const {data,attachments}=snapshot(spec,'Saved [Image #1]',new Map([[1,png]]),limits);
 assert.throws(()=>restoreDraft({...data,outcomeId:'other'},attachments,spec,limits),/different/);
 assert.throws(()=>restoreDraft({...data,schema:'unknown'},attachments,spec,limits),/different/);
 assert.throws(()=>restoreDraft({...data,answers:[...data.answers,{questionId:'old-question'}]},attachments,spec,limits),/different/);
 const broken=structuredClone(data);broken.answers[0].images[0].offset=0;
 assert.throws(()=>restoreDraft(broken,attachments,spec,limits),/reference/);
});

test('oversize feedback or unsupported files fail before editing user data',()=>{
 const images=new Map([[1,png]]);
 assert.throws(()=>snapshot(spec,'x'.repeat(12001),images,limits),/12,000/);
 assert.throws(()=>snapshot(spec,'[Image #1]',images,{...limits,artifactBytes:1}),/file limit/);
 assert.throws(()=>snapshot(spec,'Saved',images,{...limits,jsonBytes:2}),/too large/);
 assert.throws(()=>snapshot(spec,'[Image #2]',new Map([[2,new Blob(['x'],{type:'image/svg+xml'})]]),limits),/PNG/);
 assert.equal(images.get(1),png);
});

test('unknown schema and invalid report fields fail clearly',()=>{
 assert.throws(()=>normalizeInput({...input,schema:'outcome/v2'}),/schema/);
 assert.throws(()=>normalizeInput({...input,markdown:''}),/Markdown/);
 assert.throws(()=>normalizeInput({...input,markdown:'x'.repeat(900001)}),/Markdown/);
 assert.throws(()=>normalizeInput({...input,id:'../wrong'}),/id/);
});

test('outcome owns its page and modules, with no runtime dependency on the interview skill',async()=>{
 const root=new URL('../skills/show-outcome/',import.meta.url);
 for(const file of ['SKILL.md','references/authoring.md','assets/outcome.html','assets/outcome.mjs','assets/model.mjs']){
  const text=await readFile(new URL(file,root),'utf8');assert.doesNotMatch(text,/\.\.\/grill-form|\.\.\/\.\.\/grill-form/);
 }
 const bundle=await assemble({assets:new URL('assets/',root),entry:'outcome.html'});
 const html=await readFile(bundle.html,'utf8');
 for(const [,local] of html.matchAll(/(?:src|href)="([^":]+)"/g))await readFile(new URL(local,pathToFileURL(bundle.html)));
 assert.ok((await readdir(bundle.directory+'/fungi-ui/assets/vendor/')).includes('pele-LICENSE'));
});


test('inline editors preserve actual image offsets even beside typed image-like text',()=>{
 const notes='Typed [Image #1], then actual [Image #1]';
 const result=snapshot(spec,notes,new Map([[1,png]]),limits,true,[],[{id:1,offset:notes.lastIndexOf('[Image #1]')}]);
 assert.equal(result.data.answers[0].images[0].offset,notes.lastIndexOf('[Image #1]'));
 assert.throws(()=>snapshot(spec,notes,new Map([[1,png]]),limits,true,[],[{id:1,offset:0}]),/editor image/);
});
