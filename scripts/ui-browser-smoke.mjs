// Bounded gallery check through real controls and a public page-API test double.
import {assemble} from '../skills/fungi-ui/scripts/assemble.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [modulePath,chromePath,outputPath]=process.argv.slice(2);
if(!outputPath)throw new Error('Usage: node scripts/ui-browser-smoke.mjs PUPPETEER_MODULE CHROME OUTPUT_DIR');
const {default:puppeteer}=await import(pathToFileURL(path.resolve(modulePath)));
const output=path.resolve(outputPath);await mkdir(output,{recursive:true});
const {directory:root}=await assemble({assets:new URL('../skills/fungi-ui/examples/',import.meta.url),entry:'gallery.html',theme:'classic'});
const server=createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))throw new Error('Outside fixture');res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;const evidence={scope:'Shared gallery components, headless Chromium with injected public bridge'};
try{
 browser=await puppeteer.launch({executablePath:chromePath,headless:true,args:['--disable-background-networking','--disable-sync']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);page.on('request',request=>/^(http:\/\/127\.0\.0\.1:|data:|about:)/.test(request.url())?request.continue():request.abort());
 await page.evaluateOnNewDocument(()=>{
  window.fixture={submits:0};window.fungi={ready:async()=>({input:null,draft:null,attachments:[],limits:{jsonBytes:1048576,artifactBytes:20971520,totalArtifactBytes:104857600}}),saveDraft:async data=>{fixture.draft=data;},submit:async(data,attachments)=>{fixture.submits++;await new Promise(r=>setTimeout(r,50));fixture.result=data;fixture.artifactCount=attachments.length;},cancel:async()=>{fixture.cancelled=true;}};
 });
 await page.setViewport({width:1200,height:900});await page.goto('http://127.0.0.1:'+server.address().port+'/gallery.html');
 await page.waitForSelector('.diagram[data-render-state="ready"]');await page.click('#custom');
 assert.equal(await page.$eval('.custom-control',el=>getComputedStyle(el).borderColor),'rgb(47, 143, 111)');
 await page.focus('#gallery-notes');await page.keyboard.type('A shared editor ');
 await page.evaluate(()=>{
  const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9kAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  const data=new DataTransfer();data.items.add(new File([bytes],'fixture.png',{type:'image/png'}));document.getElementById('gallery-notes').dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
 });
 await page.waitForFunction(()=>fixture.draft?.value.images.length===1);
 await page.click('#gallery-notes .image-chip');await page.waitForSelector('.image-preview[open]');await page.click('.image-preview button');
 await page.focus('#gallery-notes .image-chip');await page.keyboard.press('Backspace');assert.equal(await page.$('#gallery-notes .image-chip'),null);
 assert.equal(await page.evaluate(()=>{document.getElementById('gallery-notes').focus();return document.execCommand('undo');}),true);await page.waitForSelector('#gallery-notes .image-chip');
 const frame=await (await page.$('iframe.prototype')).contentFrame();await frame.click('#density');
 await page.waitForFunction(()=>fixture.draft?.value.state.roomy===false);
 await page.click('.comment-toggle');await page.focus('.comment-surface');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 await page.waitForSelector('.comment-dialog[open]');await page.type('.comment-dialog .notes-editor','Keep this spacing');await page.click('.save-comment');
 await page.waitForFunction(()=>!document.querySelector('.comment-dialog'));
 await frame.click('#density');await page.waitForFunction(()=>fixture.draft?.value.state.roomy===true);
 await page.screenshot({path:path.join(output,'gallery-desktop.png'),fullPage:true});
 await page.setViewport({width:420,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:path.join(output,'gallery-narrow.png'),fullPage:true});
 await page.evaluate(()=>{document.getElementById('submit').click();document.getElementById('submit').click();});await page.waitForFunction(()=>!!fixture.result);
 const data=await page.evaluate(()=>({data:fixture.result,submits:fixture.submits,artifacts:fixture.artifactCount}));
 assert.equal(data.submits,1);assert.equal(data.artifacts,1);assert.equal(data.data.value.comments[0].notes,'Keep this spacing');assert.equal(data.data.value.comments[0].state.roomy,false);assert.equal(data.data.value.state.roomy,true);assert.deepEqual(data.data.value.selected,['custom']);assert.deepEqual(errors,[]);
 evidence.result='Passed';evidence.resultData=data;evidence.pageErrors=errors;evidence.checks=['CSS override','PNG paste, preview, keyboard delete and browser undo command','Interactive preview state','Keyboard region selection and comment','Captured comment state differs from final preview state','420 px layout','One submission despite double click'];
}catch(error){evidence.result='Failed';evidence.error=error.stack;process.exitCode=1;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
await writeFile(path.join(output,'gallery.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({result:evidence.result,error:evidence.error}));
