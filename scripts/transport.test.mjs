import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSpec, validateAnswers} from '../skills/grill-form/assets/model.mjs';
import {snapshot, restoreDraft, SCHEMA} from '../skills/grill-form/assets/transport.mjs';

const limits={jsonBytes:1048576,artifactBytes:20971520,totalArtifactBytes:104857600};
const spec=normalizeSpec({title:'Test',questions:[{id:'choice',prompt:'Choose',options:['A','B']},{id:'review',prompt:'Review',preview:{html:'<p>Example</p>',state:{size:16}}}]},{richText:true,review:true});
const blank=()=>spec.questions.map(q=>({questionId:q.id,choiceId:null,notes:''}));
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9kAAAAASUVORK5CYII=';

test('partial feedback preserves untouched items and returns selected labels',()=>{
  const answers=blank();answers[0].choiceId='option2';
  const {data}=snapshot(spec,answers,limits,true);
  assert.equal(data.schema,SCHEMA);
  assert.equal(data.answers[0].choice,'B');
  assert.equal(data.answers[1].status,'untouched');
  assert.throws(()=>snapshot(spec,blank(),limits,true),/some feedback/);
});

test('required answers and Something else retain their meaning',()=>{
  const answers=blank();answers[0].choiceId='other';
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
  assert.deepEqual(restored,answers);
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
