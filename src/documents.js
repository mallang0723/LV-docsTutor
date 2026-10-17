import {TARGET_DOCS} from './core.js';

export async function readDocuments(fetcher=fetch) {
  const response=await fetcher('/api/v1/docs/catalog');
  if(!response.ok)throw Error(`docs를 읽지 못했습니다 (HTTP ${response.status}).`);
  const catalog=await response.json();
  if(!Array.isArray(catalog)||TARGET_DOCS.some(path=>!catalog.some(row=>row.path===path)))throw Error('문서 구조가 바뀌었습니다. 필요한 가이드가 없습니다.');
  const docs=[];
  for(const path of TARGET_DOCS) {
    const encoded=btoa(path).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const file=await fetcher(`/api/v1/docs/file/${encoded}`);
    if(!file.ok)throw Error(`docs/${path} 읽기 실패 (HTTP ${file.status}).`);
    const content=await file.text();
    if(!content.trim()||content.length>150000||/^\s*<!doctype html/i.test(content))throw Error(`docs/${path} 응답을 확인할 수 없습니다.`);
    docs.push({path,content});
  }
  return docs;
}

// Host Vite locale globs. Only import the host's data-only i18n chunks,
// never eval bundle text, extension/user scripts, or remote URLs.
export function discoverLocaleModules(source,sourceUrl) {
  const regex=/["']\.\/locales\/(en|ko)\/([\w-]+)\.json["']\s*:\s*\(\)\s*=>[^;]{0,80}?import\([`"'](\.\/i18n\/(?:en|ko)-[\w-]+\.js)[`"']\)\.then\((\w+)\s*=>\s*\4\.(\w+)\)/g;
  return [...source.matchAll(regex)].map(m=>({language:m[1],namespace:m[2],url:new URL(m[3],sourceUrl).href,exportName:m[5]}));
}

export async function loadInstalledLocales(refs,loader=url=>import(/* @vite-ignore */ url)) {
  const result={en:{},ko:{}};
  if(!refs.some(r=>r.language==='ko'))return result;
  const cache=new Map();
  for(const ref of refs) {
    if(!cache.has(ref.url))cache.set(ref.url,await loader(ref.url));
    const value=cache.get(ref.url)?.[ref.exportName]?.default;
    if(value&&typeof value==='object')result[ref.language][ref.namespace]=value;
  }
  return result;
}

export async function hostLocales(document,fetcher=fetch) {
  const sources=[...document.querySelectorAll('script[src],link[rel="modulepreload"][href]')]
    .map(el=>new URL(el.src||el.href,document.baseURI))
    .filter(url=>url.origin===location.origin&&/^\/assets\/[\w-]+\.js$/.test(url.pathname));
  for(const url of sources.slice(0,8)) {
    const response=await fetcher(url.href);
    if(!response.ok)continue;
    const refs=discoverLocaleModules(await response.text(),url.href);
    if(refs.some(r=>r.language==='ko'))return loadInstalledLocales(refs);
  }
  return {en:{},ko:{}};
}
