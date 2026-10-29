// The workflow composes shared UI; question and result semantics stay here.
import {normalizeSpec, previews} from './model.mjs';
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
 const ready=await fungi.ready(),spec=normalizeSpec(ready.input),questions=spec.questions;
 const projectName=typeof ready.input.projectName==='string'?ready.input.projectName:'';
 document.getElementById('project-name').textContent=projectName;document.getElementById('title').textContent=spec.title;document.title=[projectName,spec.title].filter(Boolean).join(' — ');
 const draft=await restoreDraft(ready.draft,ready.attachments,spec);
 const answers=draft??questions.map(q=>({questionId:q.id,selection:q.selection,choiceIds:[],notes:''}));
 let feedback;const changed=()=>feedback?.changed();
 const notes=createNotes({values:()=>answers.flatMap(a=>[a,...(a.comments??[])]),limits:{fileBytes:ready.limits.artifactBytes,totalBytes:ready.limits.totalArtifactBytes},onChange:changed});

 questions.forEach((q,i)=>{
  const answer=answers[i],field=createField((q.prompt?q.number+'. '+q.prompt:'Review '+q.number)+(q.required?' · Required':''));
  const comments=createComments({id:q.id,previews:previews(q),value:answer,notes,onChange:changed,labels:Object.fromEntries(q.options.map(o=>['option-'+o.id,o.label]))});
  const preview=(value,key,onSelect)=>createPreview({preview:value,label:(q.prompt||'Review '+q.number)+' preview',state:answer.states?.[key],onState:value=>{answer.states??={};answer.states[key]=value;changed();},onRegion:(region,state)=>comments.add(key,region,state),onSelect,commentable:!q.options.length});
  if(q.preview)field.append(preview(q.preview,'main'));
  if(q.context.trim())field.append(createRichContent(q.context,{label:'Description for question '+q.number}));
  if(q.recommendation)field.append(element('p','Recommended: '+q.recommendation,'recommendation'));
  if(q.options.length&&q.selection==='multiple')field.append(element('p','Select all that apply.','hint'));
  const choices=element('div',undefined,'choices'+(q.options.some(o=>o.preview)?' visual-choices':''));
  const clear=q.options.length?button('Clear selection',{className:'quiet clear-selection'}):null;
  for(const option of q.options.length?[...q.options,{id:'other',label:'Something else'}]:[]){
   const choice=createChoice({type:q.selection==='multiple'?'checkbox':'radio',name:q.id,value:option.id,label:option.label,checked:answer.choiceIds.includes(option.id),onChange:checked=>{
    answer.choiceIds=q.selection==='single'?[option.id]:checked?[...answer.choiceIds,option.id]:answer.choiceIds.filter(id=>id!==option.id);
    clear.hidden=!answer.choiceIds.length;changed();
   }});
   if(option.preview){const select=()=>choice.input.click();choices.append(createChoiceCard({control:choice.element,preview:preview(option.preview,'option-'+option.id,select),onSelect:select}));}
   else choices.append(choice.element);
  }
  if(clear){clear.hidden=!answer.choiceIds.length;clear.addEventListener('click',()=>{const chosen=choices.querySelector('input:checked');answer.choiceIds=[];choices.querySelectorAll('input').forEach(r=>r.checked=false);clear.hidden=true;changed();chosen?.focus();});choices.append(clear);}
  const editor=notes.createEditor({id:'notes-'+q.id,label:'Notes for question '+q.number,value:answer});
  if(q.options.length)editor.notes.classList.add('compact');
  field.append(choices,comments.box,element('div','Notes','notes-label'),editor.notes,editor.error);form.insertBefore(field,controls.actions);
 });
 feedback=createFeedback({form,controls,ready:()=>notes.ready(),restored:!!draft,snapshot:submitted=>{
  return snapshot(spec,answers,ready.limits,submitted);
 }});
}
start().catch(error=>{controls.message.textContent=error.message;controls.message.hidden=false;controls.submit.disabled=true;});
