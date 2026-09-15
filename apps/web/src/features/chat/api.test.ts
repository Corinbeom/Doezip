import {expect,it} from 'vitest';
import {readChat,type ChatEvent} from './api';
const id='11111111-1111-4111-8111-111111111111';
const message={id,seqNo:2,role:'ASSISTANT',contentText:'한글 답변',status:'COMPLETED',replyToMessageId:id,createdAt:'2026-09-14T00:00:00Z',completedAt:'2026-09-14T00:00:01Z'};
function stream(text:string){const bytes=new TextEncoder().encode(text);return new ReadableStream<Uint8Array>({start(c){for(const byte of bytes)c.enqueue(Uint8Array.of(byte));c.close();}});}
const start=`event: start\r\ndata: ${JSON.stringify({userMessageId:id,assistantMessageId:id})}\r\n\r\n`;
it('decodes split UTF-8 and CRLF frames without assuming network chunk boundaries',async()=>{
 const events:ChatEvent[]=[];await readChat(stream(start+': heartbeat\n\nevent: delta\ndata: '+JSON.stringify({assistantMessageId:id,delta:'한글 답변'})+'\n\nevent: done\ndata: '+JSON.stringify({message})+'\n\n'),e=>events.push(e));
 expect(events).toEqual([{type:'start',id},{type:'delta',text:'한글 답변'},{type:'done',message}]);
});
it('does not invent completion on disconnect or accept tokens for another message',async()=>{
 await expect(readChat(stream(start),()=>{})).rejects.toThrow('disconnected');
 await expect(readChat(stream(start+'event: delta\ndata: '+JSON.stringify({assistantMessageId:'22222222-2222-4222-8222-222222222222',delta:'wrong'})+'\n\n'),()=>{})).rejects.toThrow('Invalid delta');
});
it('preserves terminal failed state after a safe stream error',async()=>{
 const events:ChatEvent[]=[];await readChat(stream(start+'event: stream_error\ndata: '+JSON.stringify({code:'CHAT_PROVIDER_FAILED',message:'실패',requestId:'trace'})+'\n\nevent: done\ndata: '+JSON.stringify({message:{...message,status:'FAILED'}})+'\n\n'),e=>events.push(e));expect(events[1]).toEqual({type:'error',message:'실패'});expect(events[2]).toMatchObject({type:'done',message:{status:'FAILED'}});
});
