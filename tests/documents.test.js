import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readDocuments, discoverLocaleModules, loadInstalledLocales} from '../src/documents.js';
import {TARGET_DOCS} from '../src/core.js';

test('catalog checked first and guide endpoint uses base64url',async()=>{
  const urls=[];
  const fetcher=async(url)=>{urls.push(url);return url.endsWith('/catalog')?{ok:true,json:async()=>TARGET_DOCS.map(path=>({path}))}:{ok:true,text:async()=> '# Source\n\nUntouched **English**.'};};
  const docs=await readDocuments(fetcher);
  assert.equal(docs.length,TARGET_DOCS.length);
  assert.equal(urls[0],'/api/v1/docs/catalog');
  assert.equal(urls[1],'/api/v1/docs/file/'+Buffer.from(TARGET_DOCS[0]).toString('base64url'));
});

test('missing whitelist fails before file reads',async()=>{
  let calls=0;
  await assert.rejects(readDocuments(async()=>{calls++;return {ok:true,json:async()=>[]};}),/문서 구조/);
  assert.equal(calls,1);
});

test('installed Vite same-key en and ko bundles resolved; absent ko does not import',async()=>{
  const text='"./locales/en/chat.json":()=>w(()=>import(`./i18n/en-hash.js`).then(e=>e.a),[]),"./locales/ko/chat.json":()=>w(()=>import(`./i18n/ko-hash.js`).then(e=>e.b),[])';
  const refs=discoverLocaleModules(text,'https://app.test/assets/global-abc.js');
  assert.equal(refs.length,2);
  assert.equal(refs[1].url,'https://app.test/assets/i18n/ko-hash.js');
  const locales=await loadInstalledLocales(refs,async(url)=>url.includes('/en-')?{a:{default:{test:'Impersonate'}}}:{b:{default:{test:'대리 작성'}}});
  assert.equal(locales.ko.chat.test,'대리 작성');
  let called=false;
  const absent=await loadInstalledLocales(refs.slice(0,1),async()=>{called=true;});
  assert.deepEqual(absent,{en:{},ko:{}});assert.equal(called,false);
});
