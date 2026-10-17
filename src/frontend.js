import {mountTutor} from './ui.js';
import {readDocuments,hostLocales} from './documents.js';

export function setup(ctx) {
  let alive=true;
  const controller=new AbortController(),pending=new Map();
  const rpc=(op,args={})=>new Promise((resolve,reject)=>{
    if(!alive)return reject(Error('확장이 비활성화되었습니다.'));
    const id=crypto.randomUUID();
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('응답 시간 초과. 서버 변경이 일부 완료되었을 수 있습니다. 상태를 확인한 뒤 재실행하세요.'));},300000);
    pending.set(id,{resolve,reject,timer});
    ctx.sendToBackend({id,op,args});
  });
  const off=ctx.onBackendMessage(message=>{
    const item=pending.get(message?.id);if(!item)return;
    pending.delete(message.id);clearTimeout(item.timer);
    if(message.error)item.reject(Error(message.error));else item.resolve(message.result);
  });
  const fetcher=(url)=>fetch(url,{credentials:'same-origin',signal:controller.signal});
  const unmount=mountTutor(ctx,{listCharacters:()=>rpc('characters')},async(characterIds,progress)=>{
    progress('공식 가이드 영어 원문 읽는 중... (번역·모델 호출 없음)');
    const docs=await readDocuments(fetcher);
    progress('설치된 한국어 UI 단어집 확인 중...');
    let locales;
    try{locales=await hostLocales(document,fetcher);}catch{locales={en:{},ko:{}};}
    if(!alive)throw Error('확장이 비활성화되었습니다.');
    progress(`docs ${docs.length}편 읽기 완료. 로어북 항목 갱신·장착 중...`);
    const result=await rpc('run',{docs,locales,characterIds});
    progress(`항목 ${result.total}개 · 상시 지시문+단어집 ${result.constantCharacters}자 · 설치 UI 대응 ${result.localeTerms}개`);
    return result;
  });
  return ()=>{
    alive=false;controller.abort();unmount();off();
    for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('확장이 비활성화되었습니다.'));}
    pending.clear();
  };
}
