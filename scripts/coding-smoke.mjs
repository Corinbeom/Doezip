import {readFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {spawn} from 'node:child_process';
const env={...(existsSync('.env')?parseEnv(readFileSync('.env','utf8')):{}),...process.env};
if(!env.GEMINI_API_KEY)throw new Error('GEMINI_API_KEY를 로컬 .env에 설정하세요.');
const child=spawn('./gradlew',['--no-daemon','aiSmoke','--tests','com.doezip.coding.LiveCodingAiTest'],{cwd:'apps/api',env,stdio:'inherit'});
child.on('error',()=>{console.error('검사를 시작하지 못했습니다.');process.exitCode=1;});child.on('exit',async code=>{
  if(code!==0){process.exitCode=code??1;return;}
  try {
    const {code:proposal}=JSON.parse(readFileSync('apps/api/build/coding-live-proposal.json','utf8'));
    const {runCode}=await import('../apps/web/src/features/coding/runner.ts');
    const results=await runCode(proposal);
    console.log(`Actual AI proposal public checks: ${results.filter(r=>r.passed).length}/${results.length}`);
    if(results.some(r=>!r.passed))process.exitCode=1;
  } catch {console.error('생성 코드의 실제 실행 검증에 실패했습니다.');process.exitCode=1;}
});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
