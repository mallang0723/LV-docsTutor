import {BOOK_NAME, OWNER, TARGET_DOCS, buildEntries, resolveGlossary} from './core.js';

export async function allPages(load) {
  const rows=[];
  for (let offset=0; offset<100000; offset+=200) {
    const page=await load({limit:200,offset});
    if (!Array.isArray(page?.data)) throw Error('목록 응답 형식이 바뀌었습니다.');
    rows.push(...page.data);
    if (rows.length>=page.total || !page.data.length) return rows;
  }
  throw Error('목록 크기가 한도를 넘었습니다.');
}

export function createService(api) {
  const busy=new Set(); let alive=true;
  const check=()=>{if(!alive)throw Error('확장이 비활성화되어 중단했습니다. 완료된 변경은 유지됩니다.');};
  async function characters(user) {
    return (await allPages(opts=>api.characters.list({...opts,userId:user}))).map(({id,name})=>({id,name}));
  }
  async function run(user,input) {
    if(busy.has(user))throw Error('이미 작업 중입니다.');
    busy.add(user);
    try {
      check();
      if(!Array.isArray(input.characterIds)||!input.characterIds.length||input.characterIds.length>100)throw Error('캐릭터를 최소 1개 선택해야 합니다.');
      if(!Array.isArray(input.docs)||input.docs.length!==TARGET_DOCS.length||new Set(input.docs.map(d=>d.path)).size!==TARGET_DOCS.length||input.docs.some(d=>!TARGET_DOCS.includes(d.path)||typeof d.content!=='string'||!d.content.trim()||d.content.length>150000))throw Error('docs를 읽지 못했습니다: 화이트리스트 원문이 모두 필요합니다.');
      for(const id of input.characterIds)if(!await api.characters.get(id,user))throw Error('선택한 캐릭터가 없습니다.');
      const glossary=resolveGlossary(input.locales?.en,input.locales?.ko);
      const planned=buildEntries(input.docs,glossary);
      const books=await allPages(opts=>api.world_books.list({...opts,userId:user}));
      const saved=await api.userStorage.getJson('owned.json',{userId:user,fallback:null});
      let book=saved?.id ? await api.world_books.get(saved.id,user) : null;
      if(book?.metadata?.docs_tutor_owner!==OWNER)book=null;
      if(!book) {
        const same=books.filter(b=>b.name===BOOK_NAME);
        if(same.some(b=>b.metadata?.docs_tutor_owner!==OWNER)||same.length>1)throw Error('같은 이름의 월드북이 있지만 소유권을 확인할 수 없어 건드리지 않습니다.');
        book=same[0];
      }
      check();
      if(!book)book=await api.world_books.create({name:BOOK_NAME,description:'공식 가이드 영어 원문 기반 초보자용 지식 · 한국어 답변',metadata:{docs_tutor_owner:OWNER}},user);
      await api.userStorage.setJson('owned.json',{id:book.id},{userId:user});
      const old=await allPages(opts=>api.world_books.entries.list(book.id,{...opts,userId:user}));
      const owned=old.filter(e=>e.extensions?.[OWNER]===true);
      const retained=new Set();
      for(const entry of planned) {
        check();
        const existing=owned.find(e=>e.comment===entry.comment&&!retained.has(e.id));
        if(existing){await api.world_books.entries.update(existing.id,entry,user);retained.add(existing.id);}
        else await api.world_books.entries.create(book.id,entry,user);
      }
      // Only after all replacement writes succeeded: never delete foreign entries.
      for(const entry of owned)if(!retained.has(entry.id)){check();await api.world_books.entries.delete(entry.id,user);}
      const links=[];
      for(const id of [...new Set(input.characterIds)]) {
        check();
        try {
          const current=await api.characters.get(id,user);
          if(!current)throw Error('캐릭터가 삭제되었습니다.');
          if(!current.world_book_ids.includes(book.id)){check();await api.characters.update(id,{world_book_ids:[...current.world_book_ids,book.id]},user);}
          links.push({id,status:'linked'});
        } catch(error) {links.push({id,status:'failed',error:error.message});}
      }
      return {bookId:book.id,total:planned.length,links,constantCharacters:planned.at(-1).content.length,localeTerms:glossary.filter(t=>t.source.startsWith('installed:')).length};
    } finally {busy.delete(user);}
  }
  return {characters,run,dispose(){alive=false;}};
}
