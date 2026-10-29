import {element} from './dom.mjs';
import {createPreview} from './preview.mjs';
export function createComments({id=crypto.randomUUID(),previews,value:answer,notes:editors,onChange=()=>{},readOnly=false,labels={}}) {
 const box = element('div', undefined, 'comments');
 let nextComment = 0;
 answer.comments=(answer.comments ?? []).filter(c=>c.notes.trim());
 const label=comment=>{
  return (labels[comment.preview]?labels[comment.preview]+' · ':'')+(comment.anchor??'Area '+(answer.comments.indexOf(comment)+1));
 };
 function commentBody(comment){
  const body=element('div',undefined,'comment-body');body.append(editors.fragment(comment));
  const openImage=event=>{const chip=event.target.closest('.image-chip');if(chip){event.preventDefault();editors.previewImage(Number(chip.dataset.imageId))}};
  body.addEventListener('click',openImage);
  body.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key))openImage(event)});
  return body;
 }
 function draw(){
  box.replaceChildren();
  for(const comment of answer.comments){
   if(!comment.notes.trim())continue;
   const row=element('section',undefined,'comment-summary');
   const heading=element('div',undefined,'comment-heading');
   heading.append(element('strong',label(comment)));
   if(!readOnly||comment.region){const edit=element('button',readOnly?'View area':'View / edit','quiet view-comment');edit.type='button';edit.addEventListener('click',()=>compose(comment));heading.append(edit)}
   row.append(heading,commentBody(comment));box.append(row);
  }
 }
 function compose(comment,isNew=false){
  const readonly=readOnly;
  const original=JSON.parse(JSON.stringify(comment));
  const dialog=element('dialog',undefined,'comment-dialog');
  const heading=element('h2',label(comment));heading.id=id+'-comment-heading';dialog.setAttribute('aria-labelledby',heading.id);
  const location=comment.region?createPreview({preview:previews[comment.preview],label:label(comment),snapshot:comment,readOnly:true}):null;
  const save=element('button','Save comment');save.type='button';save.className='save-comment';
  const cancel=element('button','Cancel','quiet');cancel.type='button';
  const remove=element('button','Delete comment','quiet');remove.type='button';
  let committed=false;
  const ready=()=>{save.disabled=!comment.notes.trim()||(comment.images??[]).some(image=>!image.dataUrl)};
  const editor=readonly?null:editors.createEditor({id:id+'-comment-'+(++nextComment),value:comment,onChange:ready});
  const notes=editor?.notes??commentBody(comment);
  if(!readonly)notes.setAttribute('aria-label','Comment on '+label(comment));
  const actions=element('div',undefined,'comment-actions');actions.append(cancel,save);
  if(!isNew)actions.prepend(remove);
  if(readonly){cancel.textContent='Close';actions.replaceChildren(cancel)}
  save.addEventListener('click',()=>{if(save.disabled)return;committed=true;dialog.close()});
  cancel.addEventListener('click',()=>dialog.close());
  remove.addEventListener('click',()=>{answer.comments.splice(answer.comments.indexOf(comment),1);committed=true;dialog.close()});
  dialog.addEventListener('close',()=>{
   editor?.dispose();location?.dispose();
   if(!readonly&&!committed){if(isNew)answer.comments.splice(answer.comments.indexOf(comment),1);else{for(const key of Object.keys(comment))delete comment[key];Object.assign(comment,original)}}
   dialog.remove();draw();onChange();
   (box.querySelector('button')??box.closest('fieldset')?.querySelector('.comment-toggle'))?.focus();
  });
  dialog.append(heading);if(location)dialog.append(location);
  dialog.append(notes);if(editor)dialog.append(editor.error);dialog.append(actions);
  document.body.append(dialog);ready();dialog.showModal();(readonly?cancel:notes).focus();
 }
 function add(key,region,current){
  if(readOnly)return;
  const comment={preview:key,region,state:JSON.parse(JSON.stringify(current)),notes:''};
  answer.comments.push(comment);compose(comment,true);
 }
 draw();return {box,add};
}
