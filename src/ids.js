// Random ids that also work outside secure contexts. crypto.randomUUID exists only on HTTPS or localhost, so a
// phone that opens Lumiverse over plain http (e.g. http://100.x.y.z:7860 on Tailscale) does not have it.
// crypto.getRandomValues is available everywhere, so it builds the same RFC 4122 version 4 string;
// Math.random is the last resort for hosts without Web Crypto at all.
const hex=Array.from({length:256},(_,i)=>i.toString(16).padStart(2,'0'));

export function uuid(){
 const c=globalThis.crypto;
 if(typeof c?.randomUUID==='function')return c.randomUUID();
 const b=new Uint8Array(16);
 if(typeof c?.getRandomValues==='function')c.getRandomValues(b);
 else for(let i=0;i<16;i++)b[i]=Math.floor(Math.random()*256);
 b[6]=0x40|(b[6]&0x0f);b[8]=0x80|(b[8]&0x3f);
 const h=[...b].map(n=>hex[n]);
 return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10).join('')}`;
}
