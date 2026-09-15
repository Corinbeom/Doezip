import {readFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
const env={...(existsSync('.env')?parseEnv(readFileSync('.env','utf8')):{}),...process.env};
console.log('가상 공개 입력으로 실제 Gemini 피드백 4회 검사. 기본 CI 제외, 반복 재시도 없음.');
const result=spawnSync('./gradlew',['--no-daemon','flowQuality'],{cwd:'apps/api',env,stdio:'inherit'});
process.exitCode=result.status??1;
