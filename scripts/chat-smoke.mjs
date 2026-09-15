import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let local={};try{local=parseEnv(readFileSync(`${root}.env`,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const env={...local,...process.env};
if(!env.GEMINI_API_KEY?.trim()){console.error('GEMINI_API_KEY를 이 worktree의 .env에 저장하세요. 키 값은 출력하지 않습니다.');process.exit(1);}
console.log('가상 공개 자료로 실제 Gemini 대화를 1회 호출하고 PostgreSQL 저장·복원·중복 요청을 검증합니다.');
const run=spawnSync('./gradlew',['--no-daemon','chatSmoke'],{cwd:`${root}apps/api`,env,stdio:'inherit'});
process.exit(run.status??1);
