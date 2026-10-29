import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSpec, validateAnswers} from '../skills/grill-form/assets/model.mjs';
import {snapshot, restoreDraft, SCHEMA} from '../skills/grill-form/assets/transport.mjs';

const limits={jsonBytes:1048576,artifactBytes:20971520,totalArtifactBytes:104857600};
const spec=normalizeSpec({title:'Test',questions:[{id:'choice',prompt:'Choose',options:['A','B']},{id:'review',prompt:'Review',preview:{html:'<p>Example</p>',state:{size:16}}}]},{});
const blank=()=>spec.questions.map(q=>({questionId:q.id,selection:q.selection,choiceIds:[],notes:''}));
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9kAAAAASUVORK5CYII=';

test('partial feedback preserves untouched items and returns selected labels',()=>{
  const answers=blank();answers[0].choiceIds=['option2'];
  const {data}=snapshot(spec,answers,limits,true);
  assert.equal(data.schema,SCHEMA);
  assert.deepEqual(data.answers[0].choices,['B']);
  assert.equal(data.answers[1].status,'untouched');
  assert.throws(()=>snapshot(spec,blank(),limits,true),/some feedback/);
});

test('required answers and Something else retain their meaning',()=>{
  const answers=blank();answers[0].choiceIds=['other'];
  assert.throws(()=>snapshot(spec,answers,limits,true),/Explain/);
  answers[0].notes='Another option';
  const required=structuredClone(spec);required.questions[1].required=true;
  assert.throws(()=>snapshot(required,answers,limits,true),/Missing answer/);
  answers[1].notes='Discuss';assert.equal(snapshot(required,answers,limits,true).data.answers[1].status,'feedback');
});

test('PNG bytes round-trip through Fungi attachments and draft restoration',async()=>{
  const answers=blank();answers[1].notes='See [Image #1]';answers[1].images=[{id:1,offset:4,dataUrl:png}];
  const payload=snapshot(spec,answers,limits);
  assert.equal(payload.attachments[0].key,'image-1');
  assert.equal(payload.data.answers[1].images[0].dataUrl,undefined);
  const restored=await restoreDraft(payload.data,payload.attachments,spec);
  assert.deepEqual(restored,validateAnswers(spec,answers,{submitted:false}).answers);
  assert.equal(validateAnswers(spec,restored).answers[1].images[0].mimeType,'image/png');
  await assert.rejects(restoreDraft(payload.data,[],spec),/missing/);
  await assert.rejects(restoreDraft({...payload.data,schema:'unknown'},payload.attachments,spec),/different/);
});

test('region comments preserve their own state separately from final state',()=>{
  const answers=blank();answers[1].states={main:{size:20}};
  answers[1].comments=[{preview:'main',state:{size:18},notes:'A little smaller',region:{x:10,y:10,width:40,height:40,viewportWidth:200,viewportHeight:100,scroll:[]}}];
  const result=snapshot(spec,answers,limits,true).data.answers[1];
  assert.deepEqual(result.states.main,{size:20});assert.deepEqual(result.comments[0].state,{size:18});
  assert.equal(result.comments[0].region.x,10);
});

test('oversize feedback and malformed references fail without mutating answers',()=>{
  const answers=blank();answers[0].notes='Keep this';const before=structuredClone(answers);
  assert.throws(()=>snapshot(spec,answers,{...limits,jsonBytes:4100},true),/too large/);
  assert.deepEqual(answers,before);
  answers[1].notes='[Image #1]';answers[1].images=[{id:1,offset:0,dataUrl:png}];
  assert.throws(()=>snapshot(spec,answers,{...limits,artifactBytes:1},true),/file limit/);
  answers[1].images[0].offset=1;
  assert.throws(()=>snapshot(spec,answers,limits,true),/reference/);
});

test('multiple selections are ordered, persisted together, and can be cleared',async()=>{
  const multi=normalizeSpec({title:'Mixed',questions:[{id:'many',prompt:'Choose any',selection:'multiple',options:['A','B','C']},{id:'one',prompt:'Choose one',options:['D','E']}]});
  const answers=multi.questions.map(q=>({questionId:q.id,selection:q.selection,choiceIds:[],notes:''}));
  answers[0].choiceIds=['option3','option1'];
  const saved=snapshot(multi,answers,limits);
  assert.deepEqual(saved.data.answers[0].choiceIds,['option1','option3']);
  assert.deepEqual(saved.data.answers[0].choices,['A','C']);
  const restored=await restoreDraft(saved.data,[],multi);
  assert.deepEqual(snapshot(multi,restored,limits,true).data,saved.data);
  restored[0].choiceIds=[];
  assert.equal(snapshot(multi,restored,limits).data.answers[0].status,'untouched');
  assert.throws(()=>snapshot(multi,restored,limits,true),/some feedback/);
  restored[1].notes='Discuss';
  assert.equal(snapshot(multi,restored,limits,true).data.answers[0].status,'untouched');
  for(const ids of [['option1','option1'],['unknown'],['other','unknown']]){
    restored[0].choiceIds=ids;assert.throws(()=>snapshot(multi,restored,limits),/Invalid choices/);
  }
  restored[0].choiceIds=['option2','other'];
  assert.throws(()=>snapshot(multi,restored,limits,true),/Explain Something else/);
  restored[0].notes='Also another idea';
  assert.deepEqual(snapshot(multi,restored,limits,true).data.answers[0].choices,['B','Something else']);
  restored[1].choiceIds=['option1','option2'];
  assert.throws(()=>snapshot(multi,restored,limits),/only one/);
  assert.throws(()=>normalizeSpec({title:'Bad',questions:[{prompt:'Mode',selection:'checkbox',options:['A']}]}),/selection mode/);
});

test('v1 drafts migrate without losing notes, images, or preview and comment states',async()=>{
  const answers=blank();answers[0].choiceIds=['option1'];answers[1].notes='  See [Image #1]  ';
  answers[1].images=[{id:1,offset:6,dataUrl:png}];answers[1].states={main:{size:20}};
  answers[1].comments=[{preview:'main',state:{size:18},notes:'Comment',region:{x:0,y:0,width:10,height:10,viewportWidth:200,viewportHeight:100,scroll:[]}}];
  const saved=snapshot(spec,answers,limits),legacy=structuredClone(saved.data);
  legacy.schema='grill-form/v1';
  for(const answer of legacy.answers){answer.choiceId=answer.choiceIds[0]??null;delete answer.choiceIds;delete answer.choices;delete answer.selection;}
  const before=structuredClone(legacy),restored=await restoreDraft(legacy,saved.attachments,spec);
  assert.deepEqual(snapshot(spec,restored,limits).data,saved.data);
  assert.deepEqual(legacy,before);
  const mismatch=structuredClone(spec);mismatch.questions[0].selection='multiple';
  await assert.rejects(restoreDraft(legacy,saved.attachments,mismatch),/single-choice draft/);
  const bad=structuredClone(saved.data);bad.answers[0].selection='multiple';
  await assert.rejects(restoreDraft(bad,saved.attachments,spec),/selection mode/);
});

test('large rounds, fields, comments, images, and state use the runtime budget',()=>{
  const long='x'.repeat(13000),options=Array.from({length:30},(_,i)=>({id:'option'+i,label:'Option '+i+long}));
  const large=normalizeSpec({title:'Title'.repeat(100),questions:Array.from({length:12},(_,i)=>({id:'q'+i,prompt:long,context:long,recommendation:long,selection:'multiple',options:i===0?options:[],preview:{html:'<p>Preview</p>',height:1500,state:{text:long}}}))});
  const answers=large.questions.map(q=>({questionId:q.id,choiceIds:[],notes:''}));
  answers[0].choiceIds=['option29','option0'];answers[0].notes=long;
  answers[1].states={main:{text:long+' changed'}};
  answers[1].comments=Array.from({length:25},()=>({preview:'main',state:{text:long},notes:'Comment',region:{x:0,y:0,width:10,height:10,viewportWidth:200,viewportHeight:1500,scroll:[]}}));
  answers[2].notes='';answers[2].images=[];
  for(let id=1;id<=25;id++){
    answers[2].images.push({id,offset:answers[2].notes.length,dataUrl:png});answers[2].notes+='[Image #'+id+']';
  }
  const payload=snapshot(large,answers,limits,true);
  assert.equal(payload.data.answers.length,12);assert.deepEqual(payload.data.answers[0].choiceIds,['option0','option29']);
  assert.equal(payload.data.answers[0].notes,long);assert.equal(payload.data.answers[1].comments.length,25);
  assert.equal(payload.attachments.length,25);
  assert.throws(()=>snapshot(large,answers,{...limits,jsonBytes:5000}),/too large for Fungi/);
  assert.throws(()=>snapshot(large,answers,{...limits,totalArtifactBytes:1}),/session limit/);
});

test('an image larger than the old 5 MiB cap is accepted within the advertised file budget',()=>{
  const bytes=Buffer.concat([Buffer.from(png.split(',')[1],'base64'),Buffer.alloc(5*1024*1024)]);
  const answers=blank();answers[0].notes='[Image #1]';answers[0].images=[{id:1,offset:0,dataUrl:'data:image/png;base64,'+bytes.toString('base64')}];
  const saved=snapshot(spec,answers,limits,true);
  assert.equal(saved.attachments[0].blob.size,bytes.length);
  assert.throws(()=>snapshot(spec,answers,{...limits,artifactBytes:bytes.length-1}),/file limit/);
});
