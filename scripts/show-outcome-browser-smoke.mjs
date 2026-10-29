import {assemble} from '../skills/fungi-ui/scripts/assemble.mjs';
// Visual/retry checks with an injected public page bridge, not native delivery.
// Supply an already-installed puppeteer-core module; this does not install packages.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [modulePath,chromePath,outputPath]=process.argv.slice(2);
if(!modulePath||!chromePath||!outputPath)throw new Error('Usage: node scripts/show-outcome-browser-smoke.mjs PUPPETEER_MODULE CHROME OUTPUT_DIR');
const {default:puppeteer}=await import(pathToFileURL(path.resolve(modulePath)).href);
const output=path.resolve(outputPath);await mkdir(output,{recursive:true});
const {directory:root}=await assemble({assets:new URL('../skills/show-outcome/assets/',import.meta.url),entry:'outcome.html',theme:'classic'});
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root))throw new Error('Outside fixture');
  const bytes=await readFile(file);
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const input={schema:'outcome/v1',id:'composer-width-demo',projectName:'Design study',title:'The composer has more room',
 markdown:'Three design decisions are recorded. **App implementation has not started.**\n\n## Accepted\n\n| Decision | Result |\n| --- | --- |\n| D51 · Edge margin | 8 dp on Home and in lessons |\n| D52 · Submit | Keeps its own column, despite my recommendation |\n| D53 · Field label | Placeholder only |\n\nA line grows from **287 to 311 dp** — about 48 characters instead of 44. Lesson text keeps its 20 dp margin.\n\n## Checked and still open\n\nThe wiki rebuilt and its link check passed. Typography and confidence-slider snapping remain unresolved.\n\n```mermaid\nflowchart LR\n A[Feedback] --> B[Recorded decisions] --> C[Next spike]\n```'};
input.nextSteps=[{id:'typography',label:'Review the type scale',recommendation:'Set the reading rhythm before refining the remaining controls.'},{id:'snapping',label:'Decide confidence-slider snapping'},{id:'chips',label:'Try reply chips'}];
input.markdown+='\n\n| | Decision | Notes |\n| --- | --- | --- |\n| **D60** | Label the canvas like a map | '+('Long prose about labels and spacing. '.repeat(12))+' |';
const evidence={scope:'Headless Chromium rendering, selection and retry UI; mocked page bridge, no native delivery',input,results:{}};
let browser;
try{
 browser=await puppeteer.launch({executablePath:chromePath,headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);
 page.on('request',request=>{
  const url=request.url();
  if(url.startsWith('http://127.0.0.1:')||url.startsWith('data:')||url.startsWith('about:'))request.continue();else request.abort();
 });
 await page.evaluateOnNewDocument(input=>{
  window.fixture={input,saves:0,submits:0,failSave:true,failSubmit:true};
  window.fungi=Object.freeze({
   ready:async()=>({input,draft:null,attachments:[],limits:{jsonBytes:1048576,artifactBytes:20971520,totalArtifactBytes:104857600},delivery:{mode:'manual'}}),
   saveDraft:async(data)=>{fixture.saves++;if(fixture.failSave){fixture.failSave=false;throw new Error('Synthetic save failure')}fixture.draft=data;},
   submit:async(data)=>{fixture.submits++;if(fixture.failSubmit){fixture.failSubmit=false;throw new Error('Synthetic submit failure')}await new Promise(r=>setTimeout(r,100));fixture.result=data;},
   cancel:async()=>{fixture.cancelled=true;}
  });
 },input);
 await page.setViewport({width:1200,height:900,deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:'+server.address().port+'/outcome.html');
 await page.waitForSelector('.diagram[data-render-state="ready"]');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(22, 21, 19)');
 assert.equal(await page.$eval('#submit',el=>el.disabled),true);
 assert.equal(await page.$$eval('#next-step-options input:checked',els=>els.length),0);
 assert.equal(await page.$$eval('.choice-badge',els=>els.length),1);
 assert.equal(await page.$eval('.choice-badge',el=>el.textContent.trim()),'Recommended');
 assert.equal(await page.$eval('.choice-recommendation',el=>el.textContent),input.nextSteps[0].recommendation);
 assert.equal(await page.$eval('#next-step-typography',el=>document.getElementById(el.getAttribute('aria-labelledby')).textContent),input.nextSteps[0].label+' Recommended');
 assert.equal(await page.$eval('#next-step-typography',el=>document.getElementById(el.getAttribute('aria-describedby')).textContent),input.nextSteps[0].recommendation);
 evidence.results.recommendation='Recommended marker and reason render only for the authored action; reason is associated with the checkbox; all choices start unchecked';
 await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
 evidence.results.desktop='Report, table, diagram, unchecked next steps and Notes rendered without helper captions';
 await page.setViewport({width:420,height:900,deviceScaleFactor:1});
 await page.screenshot({path:path.join(output,'narrow.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.$eval('table:last-of-type',table=>{const cell=[...document.querySelectorAll('td')].find(td=>td.textContent==='D60');const range=document.createRange();range.selectNodeContents(cell.querySelector('strong'));return range.getClientRects().length;}),1);
 evidence.results.narrow='420 px viewport has no document horizontal overflow';
 await page.focus('#next-step-typography');await page.keyboard.press('Space');
 assert.equal(await page.$eval('#submit',el=>el.disabled),false);
 assert.equal(await page.$eval('#notes',el=>el.textContent),'');
 await page.waitForFunction(()=>document.getElementById('message').textContent==='Synthetic save failure');
 assert.equal(await page.$eval('#next-step-typography',el=>el.checked),true);
 await page.click('label:has(#next-step-snapping)');
 await page.waitForFunction(()=>document.getElementById('draft-message').textContent==='Draft saved');
 assert.deepEqual(await page.evaluate(()=>fixture.draft.selectedNextSteps.map(step=>step.id)),['typography','snapping']);
 assert.equal(await page.evaluate(()=>fixture.draft.selectedNextSteps[0].recommendation),input.nextSteps[0].recommendation);
 await page.click('#next-step-typography');await page.click('#next-step-snapping');
 assert.equal(await page.$eval('#submit',el=>el.disabled),true);
 await page.click('#next-step-snapping');
 evidence.results.selection='Keyboard and pointer selection support multiple actions without Notes; clearing them disables blank submission; failed saving preserves selections';
 const notes='#notes';
 await page.$eval(notes,el=>{el.textContent='Keep this feedback';el.dispatchEvent(new InputEvent('input',{bubbles:true}));});
 await page.$eval(notes,el=>{el.textContent+=' after retry';el.dispatchEvent(new InputEvent('input',{bubbles:true}));});
 await page.waitForFunction(()=>document.getElementById('draft-message').textContent==='Draft saved');
 await page.click('#submit');
 await page.waitForFunction(()=>document.getElementById('message').textContent==='Synthetic submit failure');
 assert.equal(await page.$eval('#feedback',el=>el.inert),false);
 assert.equal(await page.$eval(notes,el=>el.textContent),'Keep this feedback after retry');
 assert.equal(await page.$eval('#next-step-snapping',el=>el.checked),true);
 await page.evaluate(()=>{document.getElementById('submit').click();document.getElementById('submit').click();});
 await page.waitForFunction(()=>!!fixture.result);
 const result=await page.evaluate(()=>({submits:fixture.submits,data:fixture.result}));
 assert.equal(result.submits,2);assert.equal(result.data.schema,'outcome/v1');
 assert.equal(result.data.answers.length,1);
 assert.equal(result.data.answers.at(-1).notes,'Keep this feedback after retry');
 assert.deepEqual(result.data.selectedNextSteps,[input.nextSteps[1]]);
 evidence.results.retry='Save and submit errors preserve edits; retry succeeds; duplicate click does not resubmit';
 evidence.resultData=result;evidence.pageErrors=errors;assert.deepEqual(errors,[]);
 evidence.result='Passed';
}catch(error){evidence.result='Failed';evidence.error=error.stack;process.exitCode=1;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
await writeFile(path.join(output,'browser.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({result:evidence.result,evidence:path.join(output,'browser.json'),error:evidence.error}));
