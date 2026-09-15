import {z} from 'zod';
import type {components} from '@/generated/api-types';
import {authenticatedFetch,authenticatedStream} from '@/shared/api/authenticated';
export type Message=components['schemas']['Message'];
export type ChatRequest=components['schemas']['ChatRequest'];
export const messageSchema:z.ZodType<Message>=z.strictObject({id:z.uuid(),seqNo:z.number().int().positive(),role:z.enum(['USER','ASSISTANT']),contentText:z.string(),status:z.enum(['STREAMING','COMPLETED','FAILED','CANCELLED']),replyToMessageId:z.uuid().nullable(),createdAt:z.iso.datetime({offset:true}),completedAt:z.iso.datetime({offset:true}).nullable()});
const listSchema=z.strictObject({items:z.array(messageSchema),nextAfterSeq:z.number().int().nonnegative().nullable()});
export const listMessages=(id:string,signal?:AbortSignal)=>authenticatedFetch(`/sessions/${id}/messages`,listSchema,{signal});
export const cancelMessage=(id:string,messageId:string,signal?:AbortSignal)=>authenticatedFetch(`/sessions/${id}/messages/${messageId}/cancel`,messageSchema,{method:'POST',signal});
const start=z.strictObject({userMessageId:z.uuid(),assistantMessageId:z.uuid()});
const delta=z.strictObject({assistantMessageId:z.uuid(),delta:z.string()});
const done=z.strictObject({message:messageSchema});
const failure=z.object({code:z.string(),message:z.string(),requestId:z.string()});
export type ChatEvent={type:'start';id:string}|{type:'delta';text:string}|{type:'done';message:Message}|{type:'error';message:string};
export async function readChat(body:ReadableStream<Uint8Array>,receive:(event:ChatEvent)=>void){
 const reader=body.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});let buffer='',assistantId:string|null=null,finished=false,failed=false;
 function frame(value:string){
  let event='';const data:string[]=[];for(const line of value.split('\n')){if(line.startsWith('event:'))event=line.slice(6).trim();if(line.startsWith('data:'))data.push(line.slice(5).replace(/^ /,''));}
  if(!event&&!data.length)return;const valueJson:unknown=JSON.parse(data.join('\n'));
  if(finished)throw new Error('Unexpected event after completion');
  if(event==='start'){if(assistantId)throw new Error('Duplicate start');assistantId=start.parse(valueJson).assistantMessageId;receive({type:'start',id:assistantId});}
  else if(event==='delta'){const value=delta.parse(valueJson);if(!assistantId||value.assistantMessageId!==assistantId||failed)throw new Error('Invalid delta');receive({type:'delta',text:value.delta});}
  else if(event==='done'){const value=done.parse(valueJson).message;if(value.id!==assistantId||value.role!=='ASSISTANT'||value.status==='STREAMING')throw new Error('Invalid terminal message');finished=true;receive({type:'done',message:value});}
  else if(event==='stream_error'){if(!assistantId)throw new Error('Missing start');failed=true;receive({type:'error',message:failure.parse(valueJson).message});}
  else throw new Error('Unknown chat event');
 }
 try{
  while(true){const next=await reader.read();buffer+=decoder.decode(next.value,{stream:!next.done});buffer=buffer.replace(/\r\n/g,'\n');if(buffer.length>200000)throw new Error('Chat frame too large');let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){frame(buffer.slice(0,boundary));buffer=buffer.slice(boundary+2);}if(next.done)break;}
  if(!finished)throw new Error('Chat disconnected before completion');
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function sendMessage(id:string,body:ChatRequest,receive:(event:ChatEvent)=>void,signal:AbortSignal){const response=await authenticatedStream(`/sessions/${id}/messages`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream, application/json'},body:JSON.stringify(body),signal});await readChat(response.body!,receive);}
