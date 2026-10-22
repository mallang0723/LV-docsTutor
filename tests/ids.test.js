import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {uuid} from '../src/ids.js';

// Plain http on a non-localhost address (a phone reaching the PC over Tailscale) is not a secure context:
// crypto.randomUUID is missing there. Shadow the prototype method on the instance so it is really gone
// (delete on the instance does not remove the prototype method), and always restore it.
const V4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
async function withoutWebCrypto(names,fn){
  const c=globalThis.crypto;
  for(const n of names)Object.defineProperty(c,n,{value:undefined,configurable:true,writable:true});
  try{for(const n of names)assert.notEqual(typeof c[n],'function',n+' still callable');return await fn();}
  finally{for(const n of names)delete c[n];}
}

test('id fallbacks: getRandomValues, then Math.random, both give RFC 4122 v4 strings', async () => {
  await withoutWebCrypto(['randomUUID'],()=>{const ids=Array.from({length:200},uuid);for(const id of ids)assert.match(id,V4);assert.equal(new Set(ids).size,ids.length);});
  await withoutWebCrypto(['randomUUID','getRandomValues'],()=>{const ids=Array.from({length:200},uuid);for(const id of ids)assert.match(id,V4);assert.equal(new Set(ids).size,ids.length);});
  assert.equal(typeof crypto.randomUUID,'function','restored');
  assert.match(uuid(),V4);
});

test('browser code makes ids only through the fallback helper', () => {
  assert.ok(!readFileSync(new URL('../src/frontend.js',import.meta.url),'utf8').includes('crypto.randomUUID'));
  const bundle=readFileSync(new URL('../dist/frontend.js',import.meta.url),'utf8');
  assert.ok(!/\bcrypto\.randomUUID\s*\(/.test(bundle),'no direct crypto.randomUUID() call in dist/frontend.js');
  assert.equal((bundle.match(/\brandomUUID\s*\(/g)||[]).length,1,'only the guarded call inside uuid()');
  assert.match(bundle,/if \(typeof c\?\.randomUUID === "function"\)\s*return c\.randomUUID\(\);/);
});
