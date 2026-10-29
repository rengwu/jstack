import {element} from './dom.mjs';
import {validRegion} from './regions.mjs';
function previewBridge(token, initial, restore) {
 const send = (type, value) => parent.postMessage({grill: token, type, value}, '*');
 let current = initial;
 const copy = value => {
  const json = JSON.stringify(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Use a JSON state object');
  return JSON.parse(json);
 };
 Object.defineProperty(window, 'grill', {value: Object.freeze({
  get state() { return copy(current); },
  setState(value) { current = copy(value); send('state', current); }
 })});
 Object.defineProperty(window, 'fungiPreview', {value: window.grill});
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
   if (!node.scrollLeft && !node.scrollTop) continue;
   const path = [];
   for (let child=node; child.parentElement; child=child.parentElement) path.unshift([...child.parentElement.children].indexOf(child));
   scroll.push({path,x:node.scrollLeft,y:node.scrollTop});
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
export function createPreview({preview,label='Preview',state:currentState,onState=()=>{},onRegion,onSelect,snapshot,readOnly=false,commentable=true}) {
 const shell=element('div',undefined,'preview-shell'+(snapshot?' comment-location':''));
 const stage=element('div',undefined,'preview-stage');
 const frame=element('iframe',undefined,'prototype');
 frame.title=label;
 frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('referrerpolicy','no-referrer');
 frame.style.height=(snapshot?.region.viewportHeight??preview.height)+'px';
 if(snapshot){
  frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');stage.inert=true;
  stage.style.width=snapshot.region.viewportWidth+'px';frame.style.width=stage.style.width;
 }
 const token=crypto.randomUUID();
 const initial=snapshot?.state??currentState??preview.state;
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
 if(!snapshot&&!readOnly&&commentable&&onRegion){
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
  if(event.source!==frame.contentWindow||event.data?.grill!==token||readOnly||snapshot)return;
  const {type,value}=event.data;
  try{
   if(type==='state'&&value&&typeof value==='object'&&!Array.isArray(value)){
    onState(JSON.parse(JSON.stringify(value)));
   }else if(type==='select')onSelect?.();
   else if(type==='region'&&pending&&value?.request===pending.request){
    const region={...pending.region,scroll:value.scroll};
    if(!validRegion(region)||!value.state||typeof value.state!=='object'||Array.isArray(value.state))return;
    mode(false);onRegion(region,value.state);
   }
  }catch{} // Malformed messages cannot alter the parent form.
 };
 window.addEventListener('message',receive);
 shell.dispose=()=>{clearTimeout(timer);resize.disconnect();window.removeEventListener('message',receive)};
 return shell;
}
