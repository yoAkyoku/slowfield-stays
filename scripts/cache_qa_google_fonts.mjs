// Download official font assets for isolated QA; this cache is never a deployment input.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root=path.resolve('artifacts/local-crud-qa/fonts');
await mkdir(root,{recursive:true});
const specs=[
 ['Cormorant Garamond','wght@500;600;700'],['Playfair Display','wght@500;600;700'],
 ['Fraunces','ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700'],
 ['Marcellus','wght@400'],['EB Garamond','ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700'],
 ['Pinyon Script','wght@400'],['Noto Serif TC','wght@400;500;600;700'],['Noto Sans TC','wght@400;500;700'],
];
const agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const responses={}, assets=new Map();
async function request(url){
 for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetch(url,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r;}
  catch(e){if(attempt===2)throw e;}
 }
}
for(const [family,axes] of specs){
 const url=`https://fonts.googleapis.com/css2?family=${family.replaceAll(' ','+')}:${axes}&display=swap`;
 const css=await (await request(url)).text();
 if(!css.includes('@font-face'))throw new Error(`No font faces: ${family}`);
 responses[family]=css;
 for(const match of css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)){
  const asset=match[1];assets.set(asset,createHash('sha256').update(asset).digest('hex')+(path.extname(new URL(asset).pathname)||'.woff2'));
 }
 console.log('CSS',family);
}
const entries=[...assets.entries()], manifest=[];let cursor=0;
async function worker(){while(cursor<entries.length){const [url,name]=entries[cursor++];const file=path.join(root,name);let bytes;try{bytes=await readFile(file)}catch{bytes=Buffer.from(await (await request(url)).arrayBuffer());await writeFile(file,bytes)}if(bytes.length<1000)throw new Error('Invalid font file');manifest.push({url,name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});if(manifest.length%20===0)console.log('ASSETS',manifest.length,entries.length)}}
await Promise.all([worker(),worker()]);
for(const [family,css] of Object.entries(responses))responses[family]=css.replace(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g,(_all,url)=>`url(${path.join(root,assets.get(url)).replaceAll('\\','/').replace(/^[A-Za-z]:/,'')})`);
await writeFile(path.join(root,'responses.json'),JSON.stringify(responses));
await writeFile(path.join(root,'manifest.json'),JSON.stringify({source:'Google Fonts official CSS and gstatic font assets',families:specs.map(x=>x[0]),assets:manifest},null,2));
const module='const responses=require('+JSON.stringify(path.join(root,'responses.json'))+');\nmodule.exports=new Proxy({}, {get(_t,url){if(typeof url!=="string" || !url.startsWith("https://fonts.googleapis.com/"))return undefined;return responses[new URL(url).searchParams.get("family").split(":")[0]];}});\n';
await writeFile(path.join(root,'cached-font-responses.cjs'),module);
console.log('REAL_FONT_CACHE_READY',manifest.length,manifest.reduce((total,x)=>total+x.bytes,0));
