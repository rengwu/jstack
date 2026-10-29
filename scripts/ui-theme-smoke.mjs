// Renders the gallery and both workflows in every theme through an injected public page-API test double.
// Checks bundled fonts, theme tokens, text contrast and narrow layout, and captures screenshots for review.
import {assemble,themes} from '../skills/fungi-ui/scripts/assemble.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [modulePath,chromePath,outputPath]=process.argv.slice(2);
if(!outputPath)throw new Error('Usage: node scripts/ui-theme-smoke.mjs PUPPETEER_MODULE CHROME OUTPUT_DIR');
const {default:puppeteer}=await import(pathToFileURL(path.resolve(modulePath)));
const output=path.resolve(outputPath);await mkdir(output,{recursive:true});
const outcome={schema:'outcome/v1',id:'theme-review',projectName:'Synthetic theme check',title:'Theme tokens are in place',
 markdown:'Every component now reads colour, type and radii from `--ui-*` tokens. Themes override them under `data-theme`; workflow CSS still wins.\n\n## Implemented and checked\n\n| ID | Change | Status |\n| --- | --- | --- |\n| T1 | Token layer and cascade layers in `ui.css` | Checked |\n| T2 | Paper and paper-dark theme files | Accepted |\n| T3 | Personal theme setting read by the assembler | Checked |\n\nThe assembler applies the theme to the page before launch, so a routine caller never chooses one.\n\n> Previews remain as authored; a theme does not reach inside the sandboxed frame.\n\n## Still open\n\n- Which candidate becomes the second theme\n- Whether the classic refresh goes far enough\n\n```mermaid\nflowchart LR\n A[Template default] --> B[Personal setting] --> C[Assembled page]\n```',
 nextSteps:[{id:'review',label:'Review the paper theme',recommendation:'It is the candidate you chose to lead; confirm it before polishing the others.'},{id:'dark',label:'Prototype a dark paper variant'}]};
const grill={projectName:'Synthetic theme check',title:'Second theme review',questions:[
 {id:'density',prompt:'How dense should report tables be?',context:'| Setting | Row height | Fits on screen |\n| --- | --- | --- |\n| Comfortable | 36 px | 14 rows |\n| Compact | 28 px | 18 rows |',recommendation:'Comfortable: reports are read more than scanned.',options:['Comfortable','Compact']},
 {id:'concerns',prompt:'Anything that feels off in this theme?'}]};
const pages=[
 ['gallery',new URL('../skills/fungi-ui/examples/',import.meta.url),'gallery.html',null,'.diagram[data-render-state="ready"]'],
 ['outcome',new URL('../skills/show-outcome/assets/',import.meta.url),'outcome.html',outcome,'.diagram[data-render-state="ready"]'],
 ['grill-form',new URL('../skills/grill-form/assets/',import.meta.url),'form.html',grill,'#submit'],
];
const types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.woff2':'font/woff2'};
let root;const server=createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))throw new Error('Outside fixture');res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
// WCAG contrast of token pairs as rendered; text pairs need 4.5:1 and the focus ring 3:1.
function measure(){
 const probe=document.createElement('i');document.body.append(probe);
 const rgb=token=>{probe.style.color=`var(${token})`;return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0,3).map(Number);};
 const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
 const ratio=(a,b)=>{const [x,y]=[lum(rgb(a)),lum(rgb(b))].sort((m,n)=>n-m);return Math.round((x+.05)/(y+.05)*100)/100;};
 const pairs={text:['--ui-text','--ui-bg',4.5],'text-2':['--ui-text-2','--ui-bg',4.5],'text-3':['--ui-text-3','--ui-bg',4.5],'text-3 on surface':['--ui-text-3','--ui-surface',4.5],link:['--ui-link','--ui-bg',4.5],'accent text':['--ui-accent-text','--ui-bg',4.5],primary:['--ui-primary-text','--ui-primary-bg',4.5],secondary:['--ui-secondary-text','--ui-bg',4.5],chip:['--ui-chip-text','--ui-chip-bg',4.5],code:['--ui-text','--ui-code-bg',4.5],danger:['--ui-danger','--ui-bg',4.5],status:['--ui-status','--ui-bg',4.5],focus:['--ui-focus','--ui-bg',3],'input border':['--ui-border-2','--ui-bg',0]};
 const result=Object.fromEntries(Object.entries(pairs).map(([name,[fg,bg,floor]])=>[name,{ratio:ratio(fg,bg),floor}]));probe.remove();return result;
}
let browser;const evidence={scope:'Headless Chromium with an injected public page-API test double; macOS fonts and native WKWebView not exercised',themes:await themes(),results:[]};
try{
 browser=await puppeteer.launch({executablePath:chromePath,headless:true,args:['--disable-background-networking','--disable-sync']});
 for(const theme of evidence.themes)for(const [name,assets,entry,input,ready] of pages){
  const bundle=await assemble({assets,entry,theme});root=bundle.directory;
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);page.on('request',request=>/^(http:\/\/127\.0\.0\.1:|data:|about:)/.test(request.url())?request.continue():request.abort());
  await page.evaluateOnNewDocument(input=>{window.fungi={ready:async()=>({input,draft:null,attachments:[],limits:{jsonBytes:1048576,artifactBytes:20971520,totalArtifactBytes:104857600}}),saveDraft:async()=>{},submit:async()=>{},cancel:async()=>{}};},input);
  await page.setViewport({width:1200,height:900});await page.goto('http://127.0.0.1:'+server.address().port+'/'+entry);
  await page.waitForSelector(ready);await page.evaluate(()=>document.fonts.ready);
  for(const frame of page.frames())await frame.waitForFunction(()=>document.readyState==='complete'&&document.body?.childElementCount>0);
  const facts=await page.evaluate(()=>({theme:document.documentElement.dataset.theme,background:getComputedStyle(document.body).backgroundColor,fonts:[...new Set([...document.fonts].filter(font=>font.status==='loaded').map(font=>font.family.replace(/"/g,'')))].sort(),collapsedIcons:[...document.querySelectorAll('.description-toolbar:not([hidden]) .expand svg')].filter(icon=>icon.getBoundingClientRect().width<12).length}));
  const record={theme,page:name,...facts,contrast:await page.evaluate(measure),errors};
  await page.screenshot({path:path.join(output,`${theme}-${name}-desktop.png`),fullPage:true});
  await page.setViewport({width:420,height:900});record.narrowFits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
  await page.screenshot({path:path.join(output,`${theme}-${name}-narrow.png`),fullPage:true});
  record.failures=[...errors,...(facts.theme===theme?[]:['data-theme is '+facts.theme]),...(record.narrowFits?[]:['horizontal overflow at 420 px']),...(facts.fonts.length?[]:['no bundled font loaded']),...(facts.collapsedIcons?[facts.collapsedIcons+' collapsed icon button(s)']:[]),...Object.entries(record.contrast).filter(([,c])=>c.ratio<c.floor).map(([pair,c])=>`${pair} contrast ${c.ratio} < ${c.floor}`)];
  evidence.results.push(record);await page.close();
 }
 const failed=evidence.results.filter(result=>result.failures.length);
 evidence.result=failed.length?'Failed':'Passed';if(failed.length)process.exitCode=1;
}catch(error){evidence.result='Failed';evidence.error=error.stack;process.exitCode=1;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
await writeFile(path.join(output,'themes.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({result:evidence.result,error:evidence.error,failures:evidence.results?.flatMap(r=>r.failures.map(f=>`${r.theme}/${r.page}: ${f}`))}));
