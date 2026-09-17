import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let local={};try{local=parseEnv(readFileSync(`${root}.env`,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const env={...local,...process.env};
if(env.AI_EVALUATION_ENABLED!=='true'||!env.GEMINI_API_KEY?.trim()){
 console.error('명시적 AI 흐름 검사에는 AI_EVALUATION_ENABLED=true와 GEMINI_API_KEY가 필요합니다.');process.exit(1);
}
Object.assign(env,{DOEZIP_LIVE_AI:'true',NEXT_PUBLIC_SUPABASE_URL:'https://e2e-auth.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_e2e_test_only'});
console.log('로컬 테스트 인증과 가상 과제로 실제 AI 평가 1건을 요청합니다. 워커 재시도·호출 한도가 적용됩니다.');
for(const [command,args,cwd] of [[process.execPath,['scripts/run.mjs','build:web'],root],['./gradlew',['--no-daemon','bootJar'],`${root}apps/api`],['npm',['exec','--','playwright','test','--config','playwright.ai.config.ts'],root]]){
 const result=spawnSync(command,args,{cwd,env,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);
}
