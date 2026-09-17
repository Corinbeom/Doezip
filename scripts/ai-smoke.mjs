import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let local={};try{local=parseEnv(readFileSync(`${root}.env`,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const env={...local,...process.env};
if(!env.GEMINI_API_KEY?.trim()){console.error('GEMINI_API_KEY를 이 worktree의 .env에 저장하세요. 키 값은 출력하지 않습니다.');process.exit(1);}
console.log('가상 공개 입력으로 Gemini를 1회 호출하고 결과 구조·근거를 검증합니다.');
const run=spawnSync('./gradlew',['--no-daemon','aiSmoke'],{cwd:`${root}apps/api`,env,stdio:'inherit'});
process.exit(run.status??1);
