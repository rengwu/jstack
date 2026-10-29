import {normalizeInput,snapshot,restoreDraft} from './model.mjs';
import {element} from '../../fungi-ui/assets/dom.mjs';
import {createRichContent} from '../../fungi-ui/assets/rich-content.mjs';
import {createNotes} from '../../fungi-ui/assets/notes.mjs';
import {createChoice,createFeedbackControls} from '../../fungi-ui/assets/controls.mjs';
import {createFeedback} from '../../fungi-ui/assets/feedback.mjs';
import {blobToDataURL,dataURLToBlob} from '../../fungi-ui/assets/files.mjs';
const form=document.getElementById('feedback'),controls=createFeedbackControls({cancelLabel:'Close'});
form.append(controls.actions,controls.status,controls.message);
async function start(){
 const ready=await fungi.ready(),spec=normalizeInput(ready.input),draft=restoreDraft(ready.draft,ready.attachments,spec,ready.limits);
 document.getElementById('title').textContent=spec.title;
 const project=document.getElementById('project-name');project.textContent=spec.projectName;project.hidden=!spec.projectName;
 document.title=[spec.projectName,spec.title].filter(Boolean).join(' — ');
 document.getElementById('outcome-report').append(createRichContent(spec.markdown,{label:'Outcome',images:true,links:'text',expandable:false}));
 const value={notes:draft.notes,images:[]};
 for(const ref of ready.draft?.answers[0].images??[])value.images.push({id:ref.id,offset:ref.offset,dataUrl:await blobToDataURL(draft.images.get(ref.id))});
 let feedback;const changed=()=>feedback?.changed();
 const notes=createNotes({values:()=>[value],limits:{count:20,fileBytes:Math.min(5*1024*1024,ready.limits.artifactBytes),totalBytes:Math.min(20*1024*1024,ready.limits.totalArtifactBytes)},onChange:changed});
 const editor=notes.createEditor({id:'notes',label:'Notes',value});
 document.getElementById('notes-host').append(editor.notes,editor.error);
 const choices=document.getElementById('next-step-options');document.getElementById('next-steps').hidden=!spec.nextSteps.length;
 for(const step of spec.nextSteps){
  const choice=createChoice({type:'checkbox',id:'next-step-'+step.id,value:step.id,label:step.label,recommendation:step.recommendation,checked:draft.selectedIds.includes(step.id),className:'next-step',onChange:changed});
  choices.append(choice.element);
 }
 feedback=createFeedback({form,controls,ready:()=>notes.ready(),restored:!!ready.draft,snapshot:submitted=>{
  const images=new Map(value.images.map(image=>[image.id,dataURLToBlob(image.dataUrl)]));
  const ids=[...choices.querySelectorAll('input:checked')].map(input=>input.value);
  return snapshot(spec,value.notes,images,ready.limits,submitted,ids,value.images);
 }});
}
start().catch(error=>{controls.message.textContent=error.message;controls.message.hidden=false;controls.submit.disabled=true;});
