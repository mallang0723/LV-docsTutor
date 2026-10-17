import {install} from '../dist/backend.js';
import {setup} from '../dist/frontend.js';

export function mountFixture(docs) {
  let next=1;
  const books=[],entries=[],characters=[{id:'test-character',name:'초보 안내 캐릭터',world_book_ids:['personal']}],store={};
  const listeners=new Set();let handler;
  const page=(rows,{limit=200,offset=0}={})=>({data:structuredClone(rows.slice(offset,offset+limit)),total:rows.length});
  const api={
    onFrontendMessage(fn){handler=fn;return()=>handler=null;},sendToFrontend(msg){for(const fn of listeners)fn(msg);},
    userStorage:{getJson:async(k)=>structuredClone(store[k]??null),setJson:async(k,v)=>store[k]=structuredClone(v)},
    characters:{list:async(opts)=>page(characters,opts),get:async(id)=>structuredClone(characters.find(c=>c.id===id)),update:async(id,input)=>Object.assign(characters.find(c=>c.id===id),structuredClone(input))},
    world_books:{list:async(opts)=>page(books,opts),get:async(id)=>structuredClone(books.find(b=>b.id===id)),create:async(input)=>{const b={...input,id:'book-'+next++};books.push(b);return structuredClone(b);},
      entries:{list:async(id,opts)=>page(entries.filter(e=>e.world_book_id===id),opts),create:async(id,input)=>{const entry={...input,id:'entry-'+next++,world_book_id:id};entries.push(entry);return structuredClone(entry);},update:async(id,input)=>Object.assign(entries.find(e=>e.id===id),structuredClone(input)),delete:async(id)=>{entries.splice(entries.findIndex(e=>e.id===id),1);return true;}}},
  };
  const disposeBackend=install(api);
  const ctx={dom:{addStyle(css){const s=document.createElement('style');s.textContent=css;document.head.append(s);return()=>s.remove();}},
    sendToBackend(msg){queueMicrotask(()=>handler(msg,'fixture-user','fixture-document'));},onBackendMessage(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
  const disposeFrontend=setup(ctx);
  return {snapshot:()=>structuredClone({books,entries,characters}),dispose(){disposeFrontend();disposeBackend();}};
}
