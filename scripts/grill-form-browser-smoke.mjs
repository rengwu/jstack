// Actual prepared controls in Chromium; the public Fungi bridge is a test double.
// Synthetic fixtures and retained bundles stay outside the project.
import {assemble} from '../skills/fungi-ui/scripts/assemble.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const [modulePath,chromePath,outputPath]=process.argv.slice(2);
if(!outputPath)throw new Error('Usage: node scripts/grill-form-browser-smoke.mjs PUPPETEER_MODULE CHROME OUTPUT_DIR');
const {default:puppeteer}=await import(pathToFileURL(path.resolve(modulePath)));
const output=path.resolve(outputPath);await mkdir(output,{recursive:true});
const bundle=await assemble({assets:new URL('../skills/grill-form/assets/',import.meta.url),entry:'form.html',theme:'classic'});
const root=bundle.directory;
const server=createServer(async(req,res)=>{
 try{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep))throw new Error('Outside fixture');
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':'text/javascript');
  res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/form.html';
const limits={jsonBytes:1048576,artifactBytes:20971520,totalArtifactBytes:104857600};
const preview={height:100,html:'<style>body{font:16px system-ui;background:#eee;padding:16px}button{font:inherit}</style><button>Preview</button>'};
const input={title:'Multiple selection check',projectName:'Disposable fixture',questions:[
 {id:'many',prompt:'Which proposals should we explore?',selection:'multiple',options:Array.from({length:15},(_,i)=>({id:'item'+(i+1),label:'Proposal '+(i+1),...(i<2?{preview}:{})}))},
 {id:'single',prompt:'Choose one',options:[{id:'a',label:'First',preview},{id:'b',label:'Second',preview}]},
 ...Array.from({length:10},(_,i)=>({id:'review'+i,prompt:'Optional review '+(i+1)}))
]};
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9kAAAAASUVORK5CYII=';
let browser;const evidence={scope:'Prepared grill-form controls; public bridge test double',bundle:root,checks:[],consoleErrors:[]};
try{
 browser=await puppeteer.launch({executablePath:chromePath,headless:true,args:['--no-sandbox']});
 async function open(input,draft=null,budget=limits){
  const page=await browser.newPage();await page.setViewport({width:1200,height:900});
  page.on('pageerror',error=>evidence.consoleErrors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request',request=>request.url().startsWith('http://127.0.0.1:')||/^(data:|blob:|about:)/.test(request.url())?request.continue():request.abort());
  await page.evaluateOnNewDocument(({input,draft,limits})=>{
   window.submissions=[];window.saved=null;
   window.fungi={
    ready:async()=>({input,draft,attachments:[],limits}),
    saveDraft:async(data,attachments)=>{window.saved={data,attachments};},
    submit:async(data,attachments)=>{window.submissions.push({data,attachments});},
    cancel:async()=>{window.cancelled=true;}
   };
  },{input,draft,limits:budget});
  await page.goto(url);await page.waitForFunction(count=>document.querySelectorAll('fieldset').length===count,{},input.questions.length);
  return page;
 }
 const selected=page=>page.$$eval('input[name="many"]:checked',inputs=>inputs.map(input=>input.value));
 const saved=page=>page.waitForFunction(()=>document.getElementById('draft-message').textContent==='Draft saved');
 const page=await open(input);
 assert.equal(await page.$eval('#submit',node=>node.disabled),true);
 assert.deepEqual(await selected(page),[]);
 await page.click('input[name="many"][value="item1"]');
 await page.click('input[name="many"][value="item2"] + .choice-copy');
 assert.deepEqual(await selected(page),['item1','item2']);
 await page.focus('input[name="many"][value="item1"]');await page.keyboard.press('Space');
 assert.deepEqual(await selected(page),['item2']);
 const frame=await (await page.$('fieldset .prototype')).contentFrame();
 await frame.click('button');
 await page.waitForFunction(()=>document.querySelector('input[name="many"][value="item1"]').checked);
 assert.deepEqual(await selected(page),['item1','item2']);
 await frame.click('button');
 await page.waitForFunction(()=>!document.querySelector('input[name="many"][value="item1"]').checked);
 assert.deepEqual(await selected(page),['item2']);
 await page.click('fieldset .clear-selection');assert.deepEqual(await selected(page),[]);
 assert.equal(await page.$eval('#submit',node=>node.disabled),true);
 await page.click('input[name="many"][value="item15"]');
 await page.focus('input[name="many"][value="item1"]');await page.keyboard.press('Space');
 await page.click('input[name="many"][value="other"]');
 assert.equal(await page.$eval('#submit',node=>node.disabled),true);
 await page.focus('#notes-many');await page.keyboard.sendCharacter('Another proposal');
 assert.equal(await page.$eval('#submit',node=>node.disabled),false);
 await page.click('input[name="single"][value="a"] + .choice-copy');
 await page.click('input[name="single"][value="b"] + .choice-copy');
 assert.deepEqual(await page.$$eval('input[name="single"]:checked',nodes=>nodes.map(node=>node.value)),['b']);
 await saved(page);
 const draft=await page.evaluate(()=>saved.data);
 const reopened=await open(input,draft);
 assert.deepEqual(await selected(reopened),['item1','item15','other']);
 assert.equal(await reopened.$eval('#notes-many',node=>node.textContent),'Another proposal');
 await reopened.$eval('fieldset',node=>node.scrollIntoView());
 await reopened.screenshot({path:path.join(output,'multiple-desktop.png')});
 await reopened.setViewport({width:420,height:900});
 assert.ok(await reopened.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Narrow layout overflows');
 await reopened.screenshot({path:path.join(output,'multiple-narrow.png')});
 await reopened.click('#submit');
 const result=await reopened.evaluate(()=>submissions[0].data);
 assert.equal(result.schema,'grill-form/v2');
 assert.deepEqual(result.answers[0].choiceIds,['item1','item15','other']);
 assert.deepEqual(result.answers[0].choices,['Proposal 1','Proposal 15','Something else']);
 assert.equal(result.answers[2].status,'untouched');
 evidence.checks.push('12 questions and 15 options','Radio, checkbox, label, keyboard, preview toggle and clear','Something else with other selections','Draft restoration and array results','1200 px and 420 px layouts');

 const legacyInput={title:'Legacy recovery',questions:[{id:'legacy',prompt:'Choose one',options:['A','B']}]};
 const legacy=await open(legacyInput,{schema:'grill-form/v1',title:legacyInput.title,answers:[{questionId:'legacy',choiceId:'option2',notes:'Saved earlier'}]});
 assert.equal(await legacy.$eval('input[value="option2"]',node=>node.checked),true);
 await legacy.click('#submit');
 assert.deepEqual(await legacy.evaluate(()=>submissions[0].data.answers[0].choices),['B']);
 evidence.checks.push('v1 draft restores to live controls and submits v2');

 const notesInput={title:'Notes check',questions:[{id:'notes',prompt:'Feedback'}]};
 const notes=await open(notesInput);
 await notes.focus('#notes-notes');await notes.keyboard.sendCharacter('x'.repeat(13000));
 await notes.$eval('#notes-notes',(editor,png)=>{
  const bytes=Uint8Array.from(atob(png),c=>c.charCodeAt(0)),clipboard=new DataTransfer();
  for(let i=0;i<25;i++)clipboard.items.add(new File([bytes],'image'+i+'.png',{type:'image/png'}));
  editor.dispatchEvent(new ClipboardEvent('paste',{clipboardData:clipboard,bubbles:true,cancelable:true}));
 },png);
 await notes.waitForFunction(()=>document.querySelectorAll('.image-chip').length===25&&!document.getElementById('submit').disabled);
 await saved(notes);await notes.click('#submit');
 assert.equal(await notes.evaluate(()=>submissions[0].attachments.length),25);
 assert.ok(await notes.evaluate(()=>submissions[0].data.answers[0].notes.startsWith('x'.repeat(13000))));
 evidence.checks.push('13,000-character notes and 25 pasted images');

 const budget=await open(notesInput,null,{...limits,jsonBytes:6000});
 await budget.focus('#notes-notes');await budget.keyboard.sendCharacter('Saved baseline');await saved(budget);
 await budget.keyboard.sendCharacter('x'.repeat(10000));
 await budget.waitForFunction(()=>!document.getElementById('message').hidden&&document.getElementById('message').textContent.includes('too large for Fungi'));
 assert.equal(await budget.$eval('#submit',node=>node.disabled),true);
 assert.equal(await budget.$eval('#notes-notes',node=>node.textContent.length),10014);
 assert.equal(await budget.evaluate(()=>saved.data.answers[0].notes),'Saved baseline');
 await budget.$eval('#notes-notes',node=>{node.textContent='Recovered';node.dispatchEvent(new InputEvent('input',{bubbles:true}));});
 await saved(budget);await budget.click('#submit');
 assert.equal(await budget.evaluate(()=>submissions[0].data.answers[0].notes),'Recovered');
 evidence.checks.push('Runtime budget error preserves editor content and prior draft; editing recovers');
 assert.deepEqual(evidence.consoleErrors,[]);
 evidence.result='Passed';
}catch(error){evidence.result='Failed';evidence.error=error.stack;process.exitCode=1;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
await writeFile(path.join(output,'grill-browser.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({result:evidence.result,checks:evidence.checks,error:evidence.error}));
