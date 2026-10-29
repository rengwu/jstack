// The workflow composes shared UI; question and result semantics stay here.
import {normalizeSpec, IMAGE_LIMITS, validRegion} from './model.mjs';
import {snapshot,restoreDraft} from './transport.mjs';
import {element} from '../../fungi-ui/assets/dom.mjs';
import {createNotes} from '../../fungi-ui/assets/notes.mjs';
import {createPreview} from '../../fungi-ui/assets/preview.mjs';
import {createComments} from '../../fungi-ui/assets/comments.mjs';
import {createRichContent} from '../../fungi-ui/assets/rich-content.mjs';
import {button,createField,createChoice,createChoiceCard,createFeedbackControls} from '../../fungi-ui/assets/controls.mjs';
import {createFeedback} from '../../fungi-ui/assets/feedback.mjs';
const form=document.getElementById('questions'),controls=createFeedbackControls();
form.append(controls.actions,controls.status,controls.message);
async function start(){
 const ready=await fungi.ready(),spec=normalizeSpec(ready.input,{richText:true,review:true}),questions=spec.questions;
 const projectName=typeof ready.input.projectName==='string'?ready.input.projectName:'';
 document.getElementById('project-name').textContent=projectName;document.getElementById('title').textContent=spec.title;document.title=[projectName,spec.title].filter(Boolean).join(' — ');
 let answers=questions.map(q=>({questionId:q.id,choiceId:null,notes:''}));
 const draft=await restoreDraft(ready.draft,ready.attachments,spec);
 if(draft){
  if(draft.length===questions.length&&draft.every((a,i)=>a&&a.questionId===questions[i].id&&typeof a.notes==='string'&&a.notes.length<=12000&&validReviewDraft(a,questions[i])&&(a.choiceId===null||a.choiceId==='other'||questions[i].options.some(o=>o.id===a.choiceId))))answers=draft;
  else throw new Error('Saved draft does not match this questionnaire. Preserve this session for recovery.');
 }
 let feedback;const changed=()=>feedback?.changed();
 const notes=createNotes({values:()=>answers.flatMap(a=>[a,...(a.comments??[])]),limits:{...IMAGE_LIMITS,fileBytes:Math.min(IMAGE_LIMITS.fileBytes,ready.limits.artifactBytes),totalBytes:Math.min(IMAGE_LIMITS.totalBytes,ready.limits.totalArtifactBytes)},onChange:changed});
 function complete(a){return a.choiceId==='other'?!!a.notes.trim():!!a.choiceId||!!a.notes.trim()}
function itemPreviews(q) {
 return Object.fromEntries([...(q.preview ? [['main', q.preview]] : []), ...q.options.filter(o=>o.preview).map(o=>['option-'+o.id,o.preview])]);
}
function validReviewDraft(a,q) {
 const previews=itemPreviews(q);
 const validState=value=>value&&typeof value==='object'&&!Array.isArray(value)&&JSON.stringify(value).length<=12000;
 return (!a.states || (typeof a.states==='object'&&!Array.isArray(a.states))) && Object.keys(a.states ?? {}).every(key=>Object.hasOwn(previews,key)&&validState(a.states[key])) &&
  Array.isArray(a.comments ?? []) && (a.comments ?? []).length<=20 && (a.comments ?? []).every(c=>
   c&&Object.hasOwn(previews,c.preview)&&(c.region===undefined?previews[c.preview].anchors.includes(c.anchor):c.anchor===undefined&&validRegion(c.region))&&typeof c.notes==='string'&&c.notes.length<=12000&&validState(c.state));
}
function hasFeedback(a, q) {
 return complete(a) || (a.comments ?? []).some(c=>c.notes.trim()) ||
  Object.entries(a.states ?? {}).some(([key,value])=>JSON.stringify(value)!==JSON.stringify(itemPreviews(q)[key]?.state));
}
function canSubmit() {
 return answers.some((a,i)=>hasFeedback(a,questions[i])) && answers.every((a,i)=>
  (!questions[i].required || hasFeedback(a,questions[i])) &&
  (a.choiceId!=='other' || a.notes.trim() || (a.comments ?? []).some(c=>c.notes.trim())));
}

 questions.forEach((q,i)=>{
  const answer=answers[i],field=createField((q.prompt?q.number+'. '+q.prompt:'Review '+q.number)+(q.required?' · Required':''));
  const comments=createComments({id:q.id,previews:itemPreviews(q),value:answer,notes,onChange:changed,labels:Object.fromEntries(q.options.map(o=>['option-'+o.id,o.label]))});
  const preview=(value,key,onSelect)=>createPreview({preview:value,label:(q.prompt||'Review '+q.number)+' preview',state:answer.states?.[key],onState:value=>{answer.states??={};answer.states[key]=value;changed();},onRegion:(region,state)=>comments.add(key,region,state),onSelect,commentable:!q.options.length});
  if(q.preview)field.append(preview(q.preview,'main'));
  if(q.context.trim())field.append(createRichContent(q.context,{label:'Description for question '+q.number}));
  if(q.recommendation)field.append(element('p','Recommended: '+q.recommendation,'recommendation'));
  const choices=element('div',undefined,'choices'+(q.options.some(o=>o.preview)?' visual-choices':''));
  const clear=q.options.length?button('Clear selection',{className:'quiet clear-selection'}):null;
  for(const option of q.options.length?[...q.options,{id:'other',label:'Something else'}]:[]){
   const choice=createChoice({name:q.id,value:option.id,label:option.label,checked:answer.choiceId===option.id,onChange:()=>{answer.choiceId=option.id;clear.hidden=false;changed();}});
   if(option.preview){const select=()=>{if(!choice.input.checked)choice.input.click();};choices.append(createChoiceCard({control:choice.element,preview:preview(option.preview,'option-'+option.id,select),onSelect:select}));}
   else choices.append(choice.element);
  }
  if(clear){clear.hidden=!answer.choiceId;clear.addEventListener('click',()=>{const chosen=choices.querySelector('input:checked');answer.choiceId=null;choices.querySelectorAll('input').forEach(r=>r.checked=false);clear.hidden=true;changed();chosen?.focus();});choices.append(clear);}
  const editor=notes.createEditor({id:'notes-'+q.id,label:'Notes for question '+q.number,value:answer});
  if(q.options.length)editor.notes.classList.add('compact');
  field.append(choices,comments.box,element('div','Notes','notes-label'),editor.notes,editor.error);form.insertBefore(field,controls.actions);
 });
 feedback=createFeedback({form,controls,ready:()=>notes.ready(),restored:!!draft,snapshot:submitted=>{
  if(submitted&&!canSubmit())throw new Error('Share feedback on an item before submitting.');
  return snapshot(spec,answers,ready.limits,submitted);
 }});
}
start().catch(error=>{controls.message.textContent=error.message;controls.message.hidden=false;controls.submit.disabled=true;});
