import {element} from './dom.mjs';
import {button,createField,createChoice,createFeedbackControls} from './controls.mjs';
import {createRichContent} from './rich-content.mjs';
import {createNotes} from './notes.mjs';
import {createPreview} from './preview.mjs';
import {createComments} from './comments.mjs';
import {createFeedback} from './feedback.mjs';
import {blobToDataURL,dataURLToBlob} from './files.mjs';
const form=document.getElementById('gallery'),controls=createFeedbackControls();form.append(controls.actions,controls.status,controls.message);
async function start(){
 const ready=await fungi.ready();
 if(ready.draft&&ready.draft.schema!=='fungi-ui-gallery/v1')throw new Error('Unknown gallery draft.');
 const value=ready.draft?structuredClone(ready.draft.value):{notes:'',images:[],comments:[],selected:[],state:{roomy:true}};
 const allNotes=()=>[value,...value.comments];
 for(const note of allNotes())for(const image of note.images??[]){const file=ready.attachments.find(a=>a.key===image.artifact);if(!file)throw new Error('Missing gallery image.');image.dataUrl=await blobToDataURL(file.blob);delete image.artifact;delete image.mimeType;}
 let feedback;const changed=()=>feedback?.changed();
 const notes=createNotes({values:allNotes,limits:{count:20,fileBytes:Math.min(5*1024*1024,ready.limits.artifactBytes),totalBytes:Math.min(20*1024*1024,ready.limits.totalArtifactBytes)},onChange:changed});
 const add=node=>form.insertBefore(node,controls.actions);
 // Themes are the layered @import rules of ui.css; classic is the unlayered default.
 const root=document.documentElement,switcher=document.getElementById('themes');
 const themes=[...document.styleSheets].flatMap(sheet=>[...sheet.cssRules]).filter(rule=>rule instanceof CSSImportRule&&rule.layerName==='fungi-theme').map(rule=>rule.href.match(/([\w-]+)\.css$/)[1]);
 const showTheme=name=>{root.dataset.theme=name;for(const node of switcher.children)node.setAttribute('aria-pressed',String(node.value===name));};
 for(const name of ['classic',...themes]){const node=button(name,{className:'quiet',onClick:()=>{value.theme=name;showTheme(name);changed();}});node.value=name;switcher.append(node);}
 showTheme(value.theme??root.dataset.theme);
 const rich=createField('Rich content');rich.append(createRichContent('**Markdown**, tables, diagrams and code share one renderer. Links such as [Distill](https://distill.pub/) use the link colour, and `inline code` sits within the text.\n\n### A subheading\n\n- Lists keep the paragraph rhythm\n- Emphasis stays *readable* in every theme\n\n> Quoted passages are set apart from the surrounding text.\n\n| ID | Decision | Notes |\n| --- | --- | --- |\n| D60 | Keep identifiers intact | Prose wraps while wide tables can scroll within their own region. |\n\n```js\nconst theme = document.documentElement.dataset.theme;\n```\n\n```mermaid\nflowchart LR\n A[Components] --> B[Workflow composition] --> C[Prepared interface]\n```',{label:'Gallery content'}));add(rich);
 const single=createField('Single choice'),options=element('div',undefined,'choices');
 for(const [id,label,recommendation] of [['ruled','Ruled rows','Long labels stay calm when options read as a list.'],['boxed','Boxed options','']])options.append(createChoice({name:'layout',id,value:id,label,recommendation,checked:value.layout===id,onChange:()=>{value.layout=id;changed();}}).element);
 single.append(element('p','Recommendations never preselect an option.','recommendation'),options);add(single);
 const choices=createField('Choices and overrides'),list=element('div',undefined,'choices');
 for(const [id,label,custom] of [['default','Default choice',false],['custom','Workflow style override',true]]){
  const item=createChoice({type:'checkbox',id,value:id,label,checked:value.selected.includes(id),recommendation:custom?'The same component with a workflow-owned class.':'',className:custom?'custom-control':'',onChange:checked=>{value.selected=checked?[...value.selected,id]:value.selected.filter(x=>x!==id);changed();}});list.append(item.element);
 }
 choices.append(list);add(choices);
 const editorField=createField('Notes and image chips'),editor=notes.createEditor({id:'gallery-notes',value});editorField.append(editor.notes,editor.error);add(editorField);
 const preview={height:210,state:{roomy:true},html:'<style>body{margin:0;background:#e9edf2;color:#182331;font:16px system-ui;padding:24px}button{padding:10px 16px;border:0;border-radius:8px;background:#273c57;color:white}p{transition:padding .1s}</style><button id="density">Toggle spacing</button><p id="sample">An interactive design to review.</p><script>const draw=()=>sample.style.padding=fungiPreview.state.roomy?"24px 0":"4px 0";draw();density.onclick=()=>{fungiPreview.setState({roomy:!fungiPreview.state.roomy});draw()};</script>'};
 const comments=createComments({id:'gallery-review',previews:{main:preview},value,notes,onChange:changed});
 const review=createField('Interactive previews and region comments');review.append(createPreview({preview,label:'Spacing demo',state:value.state,onState:state=>{value.state=state;changed();},onRegion:(region,state)=>comments.add('main',region,state)}),comments.box);add(review);
 feedback=createFeedback({form,controls,ready:()=>notes.ready(),restored:!!ready.draft,snapshot:()=>{
  const copy=structuredClone(value),attachments=[];
  for(const note of [copy,...copy.comments])for(const image of note.images??[]){const blob=dataURLToBlob(image.dataUrl),key='image-'+image.id;attachments.push({key,name:key,blob});delete image.dataUrl;image.artifact=key;image.mimeType=blob.type;}
  return {data:{schema:'fungi-ui-gallery/v1',value:copy},attachments};
 }});
}
start().catch(error=>{controls.message.textContent=error.message;controls.message.hidden=false;});
