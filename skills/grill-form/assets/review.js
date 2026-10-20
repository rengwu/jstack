// Every preview has an opaque origin. Only bounded state, scroll positions and
// region coordinates cross the boundary; no form CSS or DOM is shared.
function previewBridge(token, initial, restore) {
 const send = (type, value) => parent.postMessage({grill: token, type, value}, '*');
 let current = initial;
 const copy = value => {
  const json = JSON.stringify(value);
  if (!value || typeof value !== 'object' || Array.isArray(value) || json.length > 12000) throw new Error('Use a state object within 12,000 characters');
  return JSON.parse(json);
 };
 Object.defineProperty(window, 'grill', {value: Object.freeze({
  get state() { return copy(current); },
  setState(value) { current = copy(value); send('state', current); }
 })});
 // Capturing observes clicks even when prototype controls stop propagation.
 window.addEventListener('click', event => {
  send('select', null);
  if (event.target.closest?.('a')) event.preventDefault();
 }, true);
 document.addEventListener('submit', event => event.preventDefault());
 window.addEventListener('message', event => {
  if (event.source !== parent || event.data?.grill !== token || event.data.type !== 'capture-region') return;
  const scroll = [];
  for (const node of document.querySelectorAll('html,body,body *')) {
   if ((!node.scrollLeft && !node.scrollTop) || scroll.length >= 64) continue;
   const path = [];
   for (let child=node; child.parentElement; child=child.parentElement) path.unshift([...child.parentElement.children].indexOf(child));
   if (path.length <= 32) scroll.push({path,x:node.scrollLeft,y:node.scrollTop});
  }
  send('region', {request:event.data.value, state:copy(current), scroll});
 });
 if (restore) window.addEventListener('load', () => requestAnimationFrame(() => {
  for (const s of restore) {
   let node = document.documentElement;
   for (const i of s.path) node = node?.children[i];
   if (node) { node.scrollLeft=s.x; node.scrollTop=s.y; }
  }
 }));
}
function renderPreview(preview, index, key, onRegion, onSelect, snapshot) {
 const shell=element('div',undefined,'preview-shell'+(snapshot?' comment-location':''));
 const stage=element('div',undefined,'preview-stage');
 const frame=element('iframe',undefined,'prototype');
 frame.title=(questions[index].prompt||'Review '+questions[index].number)+(key==='main'?' preview':' — '+questions[index].options.find(o=>'option-'+o.id===key).label);
 frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('referrerpolicy','no-referrer');
 frame.style.height=(snapshot?.region.viewportHeight??preview.height)+'px';
 if(snapshot){
  frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');stage.inert=true;
  stage.style.width=snapshot.region.viewportWidth+'px';frame.style.width=stage.style.width;
 }
 const token=crypto.randomUUID();
 const initial=snapshot?.state??answers[index].states?.[key]??preview.state;
 const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
 const policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
 // The policy and bridge precede all authored markup, including its styles.
 frame.srcdoc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+policy+'"><script>('+previewBridge.toString()+')('+json(token)+','+json(initial)+','+json(snapshot?.region.scroll??null)+')<\/script></head><body>'+preview.html+'</body></html>';
 const overlay=element('div',undefined,'comment-surface');overlay.hidden=!snapshot;
 const rectangle=element('div',undefined,'comment-region');rectangle.hidden=true;overlay.append(rectangle);
 let commenting=false,toggle,hint,drag,selected,pending,timer;
 function paint(region){
  selected=region;rectangle.hidden=!region;
  if(region)Object.assign(rectangle.style,{left:region.x+'px',top:region.y+'px',width:region.width+'px',height:region.height+'px'});
 }
 function mode(active){
  clearTimeout(timer);pending=null;drag=null;paint(null);
  commenting=active;overlay.hidden=!active;
  toggle.setAttribute('aria-pressed',String(active));toggle.textContent=active?'Cancel selection':'Comment on preview';
  hint.hidden=!active;hint.textContent='Drag any area. Arrows move; Shift + arrows resize; Enter comments.';
  if(active)overlay.focus();
 }
 function capture(){
  if(!selected||pending)return;
  onSelect?.();
  pending={request:crypto.randomUUID(),region:{...selected,viewportWidth:frame.clientWidth,viewportHeight:frame.clientHeight}};
  frame.contentWindow.postMessage({grill:token,type:'capture-region',value:pending.request},'*');
  hint.textContent='Opening comment…';
  timer=setTimeout(()=>{pending=null;hint.textContent='Could not capture this area. Try selecting it again.'},2000);
 }
 if(!snapshot&&!state.archived&&!questions[index].options.length){
  const toolbar=element('div',undefined,'preview-toolbar');
  toggle=element('button','Comment on preview','comment-toggle');toggle.type='button';toggle.setAttribute('aria-pressed','false');
  hint=element('span',undefined,'comment-hint');hint.hidden=true;hint.setAttribute('role','status');
  toggle.addEventListener('click',()=>mode(!commenting));toolbar.append(toggle,hint);shell.append(toolbar);
  overlay.tabIndex=0;overlay.setAttribute('role','group');overlay.setAttribute('aria-label','Comment area. Drag to select, or use arrow keys to move, Shift and arrows to resize, and Enter to comment. Escape cancels.');
  const point=event=>{const r=overlay.getBoundingClientRect();return {x:Math.max(0,Math.min(frame.clientWidth,Math.round(event.clientX-r.left))),y:Math.max(0,Math.min(frame.clientHeight,Math.round(event.clientY-r.top)))}};
  overlay.addEventListener('pointerdown',event=>{
   if(!event.isPrimary||event.button!==0||pending)return;
   event.preventDefault();overlay.focus();drag={...point(event),id:event.pointerId};paint(null);overlay.setPointerCapture(event.pointerId);
  });
  overlay.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.id)return;
   const p=point(event);paint({x:Math.min(drag.x,p.x),y:Math.min(drag.y,p.y),width:Math.abs(p.x-drag.x),height:Math.abs(p.y-drag.y)});
  });
  overlay.addEventListener('pointerup',event=>{
   if(!drag||event.pointerId!==drag.id)return;
   drag=null;overlay.releasePointerCapture(event.pointerId);
   if(selected?.width>=4&&selected.height>=4)capture();else paint(null);
  });
  for(const type of ['pointercancel','lostpointercapture'])overlay.addEventListener(type,()=>{if(drag){drag=null;paint(null)}});
  overlay.addEventListener('keydown',event=>{
   if(event.key==='Enter'){event.preventDefault();capture();return}
   if(!event.key.startsWith('Arrow')||pending)return;
   event.preventDefault();
   const r={...(selected??{x:20,y:20,width:Math.min(120,frame.clientWidth-20),height:Math.min(80,frame.clientHeight-20)})};
   const dx=event.key==='ArrowLeft'?-8:event.key==='ArrowRight'?8:0,dy=event.key==='ArrowUp'?-8:event.key==='ArrowDown'?8:0;
   if(event.shiftKey){r.width=Math.max(4,Math.min(frame.clientWidth-r.x,r.width+dx));r.height=Math.max(4,Math.min(frame.clientHeight-r.y,r.height+dy))}
   else {r.x=Math.max(0,Math.min(frame.clientWidth-r.width,r.x+dx));r.y=Math.max(0,Math.min(frame.clientHeight-r.height,r.y+dy))}
   paint(r);
  });
  shell.addEventListener('keydown',event=>{if(event.key==='Escape'&&commenting){event.preventDefault();mode(false);toggle.focus()}});
 }
 stage.append(frame,overlay);shell.append(stage);
 const resize=new ResizeObserver(()=>{
  if(snapshot){
   const r=snapshot.region,scale=Math.min(1,shell.clientWidth/r.viewportWidth,260/r.viewportHeight);
   stage.style.width=r.viewportWidth+'px';stage.style.height=r.viewportHeight+'px';frame.style.width=r.viewportWidth+'px';
   stage.style.transform='scale('+scale+')';stage.style.marginLeft=(shell.clientWidth-r.viewportWidth*scale)/2+'px';
   shell.style.height=(r.viewportHeight*scale+2)+'px';paint(r);
  }else{
   // Chromium rounds its viewport down. Round up and clip the fractional outer
   // pixel so the iframe background cannot leave a white seam at its edge.
   const width=Math.ceil(stage.getBoundingClientRect().width)+'px';
   if(frame.style.width!==width){frame.style.width=width;if(commenting)mode(false)}
  }
 });
 resize.observe(shell);
 const receive=event=>{
  if(event.source!==frame.contentWindow||event.data?.grill!==token||state.archived||snapshot)return;
  const {type,value}=event.data;
  try{
   if(type==='state'&&value&&typeof value==='object'&&!Array.isArray(value)&&JSON.stringify(value).length<=12000){
    answers[index].states??={};answers[index].states[key]=JSON.parse(JSON.stringify(value));update();
   }else if(type==='select')onSelect?.();
   else if(type==='region'&&pending&&value?.request===pending.request){
    const region={...pending.region,scroll:value.scroll};
    if(!validRegion(region)||!value.state||typeof value.state!=='object'||Array.isArray(value.state)||JSON.stringify(value.state).length>12000)return;
    mode(false);onRegion(key,region,value.state);
   }
  }catch{} // Malformed messages cannot alter the parent form.
 };
 window.addEventListener('message',receive);
 shell.dispose=()=>{clearTimeout(timer);resize.disconnect();window.removeEventListener('message',receive)};
 return shell;
}
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
 if (state.archived) return false;
 if (!state.review) return answers.every(complete);
 return answers.some((a,i)=>hasFeedback(a,questions[i])) && answers.every((a,i)=>
  (!questions[i].required || hasFeedback(a,questions[i])) &&
  (a.choiceId!=='other' || a.notes.trim() || (a.comments ?? []).some(c=>c.notes.trim())));
}
function commentControls(q, index) {
 const previews = itemPreviews(q), answer = answers[index];
 const box = element('div', undefined, 'comments');
 let nextComment = 0;
 answer.comments=(answer.comments ?? []).filter(c=>c.notes.trim());
 const label=comment=>{
  const option=q.options.find(o=>'option-'+o.id===comment.preview);
  return (option?option.label+' · ':'')+(comment.anchor??'Area '+(answer.comments.indexOf(comment)+1));
 };
 function commentBody(comment){
  const body=element('div',undefined,'comment-body');body.append(notesFragment(comment));
  const openImage=event=>{const chip=event.target.closest('.image-chip');if(chip){event.preventDefault();previewImage(Number(chip.dataset.imageId))}};
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
   if(!state.archived||comment.region){const edit=element('button',state.archived?'View area':'View / edit','quiet view-comment');edit.type='button';edit.addEventListener('click',()=>compose(comment));heading.append(edit)}
   row.append(heading,commentBody(comment));box.append(row);
  }
 }
 function compose(comment,isNew=false){
  const readonly=state.archived;
  const original=JSON.parse(JSON.stringify(comment));
  const dialog=element('dialog',undefined,'comment-dialog');
  const heading=element('h2',label(comment));heading.id=q.id+'-comment-heading';dialog.setAttribute('aria-labelledby',heading.id);
  const location=comment.region?renderPreview(previews[comment.preview],index,comment.preview,null,null,comment):null;
  const save=element('button','Save comment');save.type='button';save.className='save-comment';
  const cancel=element('button','Cancel','quiet');cancel.type='button';
  const remove=element('button','Delete comment','quiet');remove.type='button';
  let committed=false;
  const ready=()=>{save.disabled=!comment.notes.trim()||comment.notes.length>12000||(comment.images??[]).some(image=>!image.dataUrl)};
  const editor=readonly?null:createNotesEditor({id:q.id+'-comment-'+(++nextComment),number:q.number},index,comment,ready);
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
   dialog.remove();draw();update();
   (box.querySelector('button')??box.closest('fieldset')?.querySelector('.comment-toggle'))?.focus();
  });
  dialog.append(heading);if(location)dialog.append(location);
  dialog.append(notes);if(editor)dialog.append(editor.error);dialog.append(actions);
  document.body.append(dialog);ready();dialog.showModal();(readonly?cancel:notes).focus();
 }
 function add(key,region,current){
  if(state.archived)return;
  if(answer.comments.length>=20){box.append(element('p','This item has 20 comments. Edit or remove one before adding another.','error'));return}
  const comment={preview:key,region,state:JSON.parse(JSON.stringify(current)),notes:''};
  answer.comments.push(comment);compose(comment,true);
 }
 draw();return {box,add};
}
