import {createService} from './service.js';

export function install(api) {
  const service=createService(api);
  const off=api.onFrontendMessage(async(message,userId,frontendSessionId)=>{
    if(!message||typeof message.id!=='string'||message.id.length>100)return;
    try {
      let result;
      if(message.op==='characters')result=await service.characters(userId);
      else if(message.op==='run')result=await service.run(userId,message.args||{});
      else throw Error('알 수 없는 요청');
      api.sendToFrontend({id:message.id,result},userId,{frontendSessionId});
    } catch(error) {api.sendToFrontend({id:message.id,error:error.message},userId,{frontendSessionId});}
  });
  return ()=>{service.dispose();off();};
}
if(globalThis.spindle)install(globalThis.spindle);
