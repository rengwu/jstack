export const SCHEMA='outcome/v1';
export const NOTES_ID='outcome-notes';
const imageTypes={'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp'};
const check=(condition,message)=>{if(!condition)throw new Error(message)};
const idPattern=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;

export function normalizeInput(input){
 check(input?.schema===SCHEMA,'Unrecognized outcome schema.');
 check(typeof input.id==='string'&&idPattern.test(input.id),'Provide a valid outcome id.');
 check(typeof input.title==='string'&&input.title.trim()&&input.title.length<=200,'Provide a title within 200 characters.');
 check(typeof input.markdown==='string'&&input.markdown.trim()&&input.markdown.length<=900000,'Provide outcome Markdown within 900,000 characters.');
 check(input.questions===undefined||(Array.isArray(input.questions)&&input.questions.length===0),'Outcome presents a report and Notes. Use a separate session for questions.');
 check(input.projectName===undefined||typeof input.projectName==='string','Invalid project name.');
 check(input.nextSteps===undefined||Array.isArray(input.nextSteps),'Provide next steps as a list.');
 const ids=new Set();
 const nextSteps=(input.nextSteps??[]).map(step=>{
  check(step&&typeof step.id==='string'&&idPattern.test(step.id)&&!ids.has(step.id),'Next steps need unique, valid ids.');
  check(typeof step.label==='string'&&step.label.trim()&&step.label.length<=1000,'Give each next step a label within 1,000 characters.');
  check(step.recommendation===undefined||(typeof step.recommendation==='string'&&step.recommendation.trim()&&step.recommendation.length<=1000),'Give a recommended next step a reason within 1,000 characters.');
  ids.add(step.id);return {id:step.id,label:step.label.trim(),...(step.recommendation===undefined?{}:{recommendation:step.recommendation.trim()})};
 });
 return {id:input.id,title:input.title,markdown:input.markdown,projectName:input.projectName??'',nextSteps};
}

export function snapshot(spec,notes,images,limits,submitted=false,selectedIds=[],imageReferences){
 check(typeof notes==='string'&&notes.length<=12000,'Keep Notes within 12,000 characters.');
 check(Array.isArray(selectedIds)&&new Set(selectedIds).size===selectedIds.length&&selectedIds.every(id=>spec.nextSteps.some(step=>step.id===id)),'Select only next steps from this outcome.');
 const selectedNextSteps=spec.nextSteps.filter(step=>selectedIds.includes(step.id)).map(step=>({...step}));
 check(!submitted||notes.trim()||selectedNextSteps.length,'Add some feedback before submitting.');
 const references=[],attachments=[],seen=new Set();
 for(const match of imageReferences===undefined?notes.matchAll(/\[Image #(\d+)\]/g):imageReferences.map(ref=>({1:ref.id,index:ref.offset}))){
  const id=Number(match[1]),blob=images.get(id);
  if(imageReferences!==undefined)check(blob&&Number.isSafeInteger(match.index)&&match.index>=0&&notes.slice(match.index,match.index+`[Image #${id}]`.length)===`[Image #${id}]`&&!seen.has(id),'Invalid editor image reference.');
  if(!blob||seen.has(id))continue;
  check(Number.isSafeInteger(id)&&id>0&&id<=1000000,'Invalid image reference.');
  check(Object.hasOwn(imageTypes,blob.type),'Paste a PNG, JPEG, GIF or WebP image.');
  check(blob.size<=Math.min(5*1024*1024,limits.artifactBytes),'An image exceeds the file limit.');
  seen.add(id);
  const key='image-'+id;
  references.push({id,offset:match.index,artifact:key,mimeType:blob.type});
  attachments.push({key,name:key+'.'+imageTypes[blob.type],blob});
 }
 check(attachments.length<=20,'Use at most 20 images.');
 check(attachments.reduce((sum,a)=>sum+a.blob.size,0)<=Math.min(20*1024*1024,limits.totalArtifactBytes),'Images exceed the session limit.');
 const data={schema:SCHEMA,outcomeId:spec.id,title:spec.title,selectedNextSteps,answers:[{
  questionId:NOTES_ID,choiceId:null,choice:null,notes,status:notes.trim()?'feedback':'untouched',images:references
 }]};
 check(new TextEncoder().encode(JSON.stringify(data)).length+4096<=limits.jsonBytes,'Feedback is too large for Fungi.');
 return {data,attachments};
}

export function restoreDraft(draft,attachments,spec,limits){
 if(draft==null)return {notes:'',images:new Map(),selectedIds:[]};
 check(draft.schema===SCHEMA&&draft.outcomeId===spec.id&&draft.title===spec.title&&Array.isArray(draft.answers)&&draft.answers.length===1&&draft.answers[0]?.questionId===NOTES_ID,'Saved draft belongs to a different outcome or format. Preserve the session for recovery.');
 const answer=draft.answers[0],images=new Map(),files=new Map(attachments.map(a=>[a.key,a.blob]));
 const selected=draft.selectedNextSteps===undefined?[]:draft.selectedNextSteps;
 check(Array.isArray(selected)&&selected.every(step=>step&&spec.nextSteps.some(offered=>offered.id===step.id&&offered.label===step.label)),'Saved next steps do not match this outcome. Preserve the session for recovery.');
 const selectedIds=selected.map(step=>step.id);
 check(typeof answer.notes==='string'&&Array.isArray(answer.images??[]),'Invalid saved Notes.');
 for(const ref of answer.images??[]){
  check(Number.isSafeInteger(ref.id)&&ref.id>0&&!images.has(ref.id)&&Number.isSafeInteger(ref.offset)&&ref.offset>=0&&answer.notes.slice(ref.offset,ref.offset+`[Image #${ref.id}]`.length)===`[Image #${ref.id}]`,'Invalid saved image reference.');
  const blob=files.get(ref.artifact);check(blob,'A saved image is missing. Preserve the session for recovery.');
  check(blob.type===ref.mimeType,'A saved image has a different media type.');
  images.set(ref.id,blob);
 }
 snapshot(spec,answer.notes,images,limits,false,selectedIds);
 return {notes:answer.notes,images,selectedIds};
}
