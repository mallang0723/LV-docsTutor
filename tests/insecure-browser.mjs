// Insecure-origin fixture check: the bundled extension (tests/browser-fixture.js → dist/) over plain http on a
// non-localhost host name, the way a phone reaches Lumiverse on a PC over Tailscale (http://100.x.y.z:7860).
// Such a page is not a secure context, so crypto.randomUUID is missing; 0.1.0 failed there with
// "crypto.randomUUID is not a function" on the first frontend → backend request (the character list).
// The host name docstutor.test is mapped to a local server (Chromium: --host-resolver-rules, Firefox:
// network.dns.localDomains); no other network. Fixture only, NOT an installed-host check.
// Playwright is not a project dependency: PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs;
// FIREFOX_BIN / CHROMIUM_BIN pick browser executables.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
if(!process.env.PLAYWRIGHT_MODULE){console.error('Playwright not found (set PLAYWRIGHT_MODULE)');process.exit(2);}
const pw=await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const HOST='docstutor.test';
const page='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#1c1826;color:#f4effa;font-family:Arial,sans-serif}</style></head><body><header>Docs Tutor · insecure-origin fixture (NOT installed)</header></body></html>';
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://x');
  if(url.pathname==='/favicon.ico'){res.statusCode=204;return res.end();}
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(page);}
  try{
    const file=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(ROOT+path.sep)||!/^(tests|dist)\//.test(path.relative(ROOT,file))||!file.endsWith('.js'))throw 0;
    res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end('not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://${HOST}:${server.address().port}/`;
const browsers=[
  ['chromium',()=>pw.chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',args:[`--host-resolver-rules=MAP ${HOST} 127.0.0.1`]})],
  ['firefox',()=>pw.firefox.launch({...(process.env.FIREFOX_BIN?{executablePath:process.env.FIREFOX_BIN}:{}),firefoxUserPrefs:{'network.dns.localDomains':HOST,'network.proxy.type':0}})],
];
const failures=[],rows=[];
for(const [name,launch] of browsers){
  let browser;const errors=[];
  try{
    browser=await launch();
    const p=await browser.newPage({viewport:{width:390,height:844}});
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await p.goto(url);
    const context=await p.evaluate(()=>({secure:window.isSecureContext,randomUUID:typeof globalThis.crypto?.randomUUID,getRandomValues:typeof globalThis.crypto?.getRandomValues,subtle:typeof globalThis.crypto?.subtle,clipboard:typeof navigator.clipboard,origin:location.origin}));
    if(context.secure!==false||context.randomUUID!=='undefined'){failures.push(`${name}: page is not an insecure context (${JSON.stringify(context)}); the check proves nothing`);continue;}
    await p.evaluate(async()=>{const m=await import('/tests/browser-fixture.js');window.fixture=m.mountFixture();});
    // Opening the dialog lists characters through the frontend → backend rpc, which makes a request id.
    await p.getByRole('button',{name:'Docs Tutor 로어북 생성·장착',exact:true}).click();
    const listed=await p.getByText('초보 안내 캐릭터',{exact:true}).waitFor({timeout:10000}).then(()=>true,()=>false);
    const log=await p.evaluate(()=>document.querySelector('.mdtl-log')?.textContent||'');
    await p.evaluate(()=>window.fixture.dispose());
    rows.push({browser:name,context,listed,log,errors});
    const bad=[...errors,log].filter(t=>/randomUUID|is not a function/i.test(t));
    if(bad.length)failures.push(`${name}: ${bad.join(' | ')}`);
    if(!listed)failures.push(`${name}: character list did not load · log: ${log}`);
  }catch(e){failures.push(`${name}: ${String(e?.message||e).split('\n')[0]}${errors.length?' · page errors: '+[...new Set(errors)].join(' | '):''}`);}
  finally{await browser?.close();}
}
server.close();
console.log(JSON.stringify(rows,null,1));
if(failures.length){console.error('FAIL\n'+failures.join('\n'));process.exit(1);}
console.log(`insecure-origin fixture check passed (${rows.map(r=>r.browser+' '+r.context.origin).join(', ')})`);
