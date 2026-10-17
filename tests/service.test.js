import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createService,allPages} from '../src/service.js';
import {TARGET_DOCS,OWNER} from '../src/core.js';

function fixture() {
  let next=1;
  const books=[], entries=[], characters=[{id:'c1',name:'Test <character>',world_book_ids:['personal']}];
  const store={}; let writes=0;
  const api={
    userStorage:{getJson:async(k)=>store[k]??null,setJson:async(k,v)=>{store[k]=structuredClone(v);}},
    characters:{list:async()=>({data:characters,total:characters.length}),get:async(id)=>structuredClone(characters.find(c=>c.id===id)),update:async(id,patch)=>{writes++;Object.assign(characters.find(c=>c.id===id),patch);}},
    world_books:{list:async()=>({data:books,total:books.length}),get:async(id)=>structuredClone(books.find(b=>b.id===id)),create:async(input)=>{writes++;const b={...input,id:'b'+next++};books.push(b);return b;},
      entries:{list:async(id,{offset=0,limit=200}={})=>{const rows=entries.filter(e=>e.world_book_id===id);return {data:rows.slice(offset,offset+limit),total:rows.length};},
        create:async(id,input)=>{writes++;const e={...input,id:'e'+next++,world_book_id:id};entries.push(e);return e;},
        update:async(id,input)=>{writes++;Object.assign(entries.find(e=>e.id===id),input);},
        delete:async(id)=>{writes++;entries.splice(entries.findIndex(e=>e.id===id),1);return true;}}},
  };
  const input={characterIds:['c1'],docs:TARGET_DOCS.map(path=>({path,content:'# Guide\n\n## Start\n\nOfficial English sample.'}))};
  return {api,books,entries,characters,store,input,writes:()=>writes};
}

test('create and rerun keep book identity, links, and unmanaged entries',async()=>{
  const f=fixture(), service=createService(f.api);
  const first=await service.run('u',f.input);
  assert.ok(f.characters[0].world_book_ids.includes('personal'));
  assert.ok(f.characters[0].world_book_ids.includes(first.bookId));
  f.entries.push({id:'user',world_book_id:first.bookId,comment:'my entry',content:'Keep me'});
  const count=f.entries.length;
  const second=await service.run('u',f.input);
  assert.equal(second.bookId,first.bookId);
  assert.equal(f.books.length,1);
  assert.equal(f.entries.length,count);
  assert.equal(f.entries.find(e=>e.id==='user').content,'Keep me');
});

test('name collision and forged saved ID do not authorize mutation',async()=>{
  const f=fixture();f.books.push({id:'personal',name:'Docs Tutor',metadata:{}});f.store['owned.json']={id:'personal'};
  await assert.rejects(createService(f.api).run('u',f.input),/건드리지/);
  assert.equal(f.writes(),0);
});

test('missing docs or invalid character makes zero writes',async()=>{
  const f=fixture(),service=createService(f.api);
  await assert.rejects(service.run('u',{...f.input,docs:f.input.docs.slice(1)}));
  await assert.rejects(service.run('u',{...f.input,characterIds:['missing']}));
  assert.equal(f.writes(),0);
});

test('stale tagged entries removed but foreign entries retained',async()=>{
  const f=fixture(),service=createService(f.api);const r=await service.run('u',f.input);
  f.entries.push({id:'stale',world_book_id:r.bookId,comment:'stale',extensions:{[OWNER]:true}});
  await service.run('u',f.input);
  assert.ok(!f.entries.some(e=>e.id==='stale'));
});

test('pagination continues past 200 records',async()=>{
  const rows=Array.from({length:451},(_,id)=>({id}));
  const result=await allPages(async({offset,limit})=>({data:rows.slice(offset,offset+limit),total:rows.length}));
  assert.deepEqual(result,rows);
});

test('entry-write failure does not delete old entries; rerun recovers',async()=>{
  const f=fixture(),service=createService(f.api);const r=await service.run('u',f.input);
  f.entries.push({id:'stale',world_book_id:r.bookId,comment:'stale',extensions:{[OWNER]:true}});
  const original=f.api.world_books.entries.update;
  f.api.world_books.entries.update=async()=>{throw Error('write failure');};
  await assert.rejects(service.run('u',f.input),/write failure/);
  assert.ok(f.entries.some(e=>e.id==='stale'));
  f.api.world_books.entries.update=original;
  await service.run('u',f.input);
  assert.ok(!f.entries.some(e=>e.id==='stale'));
});

test('disposed service and simultaneous run do not start extra writes',async()=>{
  const f=fixture(),service=createService(f.api);
  const first=service.run('u',f.input);
  await assert.rejects(service.run('u',f.input),/작업 중/);
  await first;
  const writes=f.writes();service.dispose();
  await assert.rejects(service.run('u',f.input),/비활성화/);
  assert.equal(f.writes(),writes);
});
