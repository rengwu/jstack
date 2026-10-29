import {element,escapeHTML} from './dom.mjs';
let diagramNumber=0;
let diagramQueue=Promise.resolve();
function diagramFallback(container,source,reason){
 container.replaceChildren(element('p','Diagram could not be rendered. '+reason,'diagram-error'));
 const details=element('details');details.open=true;
 const pre=element('pre');pre.append(element('code',source));
 details.append(element('summary','Diagram source'),pre);container.append(details);container.dataset.renderState='error';
}
export async function renderDiagram(container,source){
 if(/%%\s*\{/.test(source)||/^\s*---/.test(source)){
  diagramFallback(container,source,'Use Mermaid syntax without configuration directives.');return;
 }
 try{
  const {svg}=pele.render(source,{idPrefix:'fungi-diagram-'+(++diagramNumber),links:false,images:false,autoDirection:false,limit:12000,maxEdges:150,outputLimit:1000000});
  container.innerHTML=DOMPurify.sanitize(svg,{USE_PROFILES:{svg:true,svgFilters:true},FORBID_TAGS:['foreignObject','image','a','style']});
  const drawing=container.querySelector('svg');
  const width=drawing?.viewBox.baseVal.width;
  if(width){drawing.style.width=Math.ceil(width)+'px';drawing.style.maxWidth='';}
  container.dataset.renderState='ready';
 }catch{diagramFallback(container,source,'The source is available below.');}
}
export function createRichContent(source,{label='Content',images=false,links='external',expandable=true}={}){
 const wrapper=element('section',undefined,'description');wrapper.setAttribute('aria-label',label);
 const content=element('div',undefined,'rich-content');content.id='content-'+crypto.randomUUID();wrapper.append(content);
 try{
  const renderer=new marked.Renderer();
  renderer.html=({text})=>escapeHTML(text);
  renderer.image=({href,text})=>images&&/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(href)?`<img src="${escapeHTML(href)}" alt="${escapeHTML(text)}">`:escapeHTML('[Image unavailable: '+text+']');
  if(links==='text')renderer.link=({href,text})=>`<span class="source-reference">${escapeHTML(text)} (${escapeHTML(href)})</span>`;
  const html=marked.parse(source,{gfm:true,breaks:false,renderer});
  content.innerHTML=DOMPurify.sanitize(html,{ALLOWED_TAGS:['p','br','strong','em','del','a','ul','ol','li','blockquote','h1','h2','h3','h4','h5','h6','pre','code','table','thead','tbody','tr','th','td','hr','img','span'],ALLOWED_ATTR:['href','title','class','align','start','src','alt']});
  content.querySelectorAll('a').forEach(link=>{if(!/^https?:\/\//i.test(link.getAttribute('href')||'')){link.removeAttribute('href');return;}link.target='_blank';link.rel='noopener noreferrer';});
  content.querySelectorAll('pre > code.language-mermaid').forEach(code=>{
   const diagram=element('div','Rendering diagram…','diagram');diagram.dataset.renderState='pending';diagram.tabIndex=0;diagram.setAttribute('role','region');diagram.setAttribute('aria-label',label+' diagram');
   const definition=code.textContent;code.parentElement.replaceWith(diagram);
   diagramQueue=diagramQueue.then(()=>renderDiagram(diagram,definition)).catch(()=>diagramFallback(diagram,definition,'The source is available below.'));
  });
 }catch{content.append(element('p','Description could not be rendered; original source follows.','error'),element('pre',source));}
 for(const table of content.querySelectorAll('table')){
  const scroll=element('div',undefined,'table-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',label+' table');table.replaceWith(scroll);scroll.append(table);
 }
 const hasDiagram=!!content.querySelector('.diagram'),wideContent=[...content.querySelectorAll('table,pre')];
 if(!expandable||(!hasDiagram&&!wideContent.length))return wrapper;
 const toolbar=element('div',undefined,'description-toolbar');
 const expand=element('button',undefined,'expand');expand.type='button';expand.setAttribute('aria-controls',content.id);
 const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.75');icon.setAttribute('stroke-linecap','round');icon.setAttribute('stroke-linejoin','round');icon.setAttribute('aria-hidden','true');
 const iconPath=document.createElementNS('http://www.w3.org/2000/svg','path');icon.append(iconPath);expand.append(icon);
 function refresh(){
  const expanded=wrapper.classList.contains('is-expanded');
  const available=expanded||hasDiagram||wideContent.some(node=>node.scrollWidth>content.clientWidth+1);
  toolbar.hidden=!available;wrapper.classList.toggle('has-expansion',available);
  content.tabIndex=available?0:-1;
  const label=expanded?'Collapse description':'Expand description';expand.setAttribute('aria-expanded',String(expanded));expand.setAttribute('aria-label',label);expand.title=label;
  iconPath.setAttribute('d',expanded?'M3 9h6V3M9 9 3 3M21 15h-6v6M15 15l6 6':'M9 3H3v6M3 3l6 6M15 21h6v-6M21 21l-6-6');
 }
 expand.addEventListener('click',()=>{wrapper.classList.toggle('is-expanded');refresh()});
 wrapper.addEventListener('keydown',event=>{if(event.key==='Escape'&&wrapper.classList.contains('is-expanded')){expand.click();expand.focus();}});
 toolbar.append(expand);wrapper.append(toolbar);
 new ResizeObserver(refresh).observe(content);refresh();
 return wrapper;
}
