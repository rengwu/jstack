import {cp,mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {homedir,tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const kitAssets=new URL('../assets/',import.meta.url);
export async function themes(){
 return ['classic',...(await readdir(new URL('themes/',kitAssets))).filter(file=>/^[a-z][a-z0-9-]*\.css$/.test(file)).map(file=>file.slice(0,-4)).sort()];
}
// The user's setting overrides each workflow's template default; nothing else chooses for routine callers.
export function settingsPath(env=process.env){
 return path.join(env.XDG_CONFIG_HOME||path.join(homedir(),'.config'),'fungi-ui','settings.json');
}
async function preferredTheme(file){
 let text;
 try{text=await readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')return;throw error;}
 const theme=JSON.parse(text).theme;
 if(theme!==undefined&&typeof theme!=='string')throw new Error(file+': theme must be a string.');
 return theme;
}
function applyTheme(html,theme){
 const tag=html.match(/<html\b[^>]*>/i);
 if(!tag)throw new Error('Entry page has no <html> element to theme.');
 const themed=/\sdata-theme=/i.test(tag[0])?tag[0].replace(/\sdata-theme=("[^"]*"|'[^']*'|[^\s>]*)/i,` data-theme="${theme}"`):tag[0].replace(/^<html\b/i,`<html data-theme="${theme}"`);
 return html.replace(tag[0],themed);
}
// A fresh retained bundle preserves page assets across edits, waiting and reopen.
export async function assemble({assets,entry,input,prefix='fungi-ui-',theme,settings=settingsPath()}){
 const source=assets instanceof URL?fileURLToPath(assets):path.resolve(assets);
 if(path.basename(entry)!==entry||!entry.endsWith('.html'))throw new Error('Entry must name an HTML file in assets.');
 let html=await readFile(path.join(source,entry),'utf8');
 const inputText=input===undefined?undefined:await readFile(path.resolve(input),'utf8');
 if(inputText!==undefined)JSON.parse(inputText);
 const chosen=theme??await preferredTheme(settings);
 if(chosen!==undefined){
  const available=await themes();
  if(!available.includes(chosen))throw new Error(`Unknown theme "${chosen}". Available: ${available.join(', ')}.`);
  html=applyTheme(html,chosen);
 }
 const directory=await mkdtemp(path.join(tmpdir(),prefix));
 const filter=file=>!path.basename(file).startsWith('.');
 // Exclude locally retained direct-page compatibility bundles from new source copies.
 await cp(source,path.join(directory,'workflow/assets'),{recursive:true,filter:file=>filter(file)&&!['workflow','fungi-ui'].includes(path.relative(source,file).split(path.sep)[0])});
 await cp(kitAssets,path.join(directory,'fungi-ui/assets'),{recursive:true,filter});
 await writeFile(path.join(directory,entry),html);
 const result={directory,html:path.join(directory,entry),theme:html.match(/<html\b[^>]*\sdata-theme="([^"]*)"/i)?.[1]??'classic'};
 if(inputText!==undefined){result.input=path.join(directory,'input.json');await writeFile(result.input,inputText);}
 return result;
}
export async function assembleCLI(options){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--input')throw new Error('Usage: node assemble.mjs --input /absolute/path/to/input.json');
 console.log(JSON.stringify(await assemble({...options,input:args[1]})));
}
