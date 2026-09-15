import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
let local = {};
try { local = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const env = { ...local, ...process.env };
const children = new Set();
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
  }
  const timer = setTimeout(() => {
    for (const child of children) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
    }
  }, 8000);
  timer.unref();
  process.exitCode = code;
}
function run(command, args, cwd = root, childEnv = env) {
  const child = spawn(command, args, { cwd, env: childEnv, stdio: 'inherit', detached: true });
  children.add(child);
  child.on('error', () => { children.delete(child); console.error(`Cannot start ${command}`); stop(1); });
  child.on('exit', (code, signal) => {
    // Remove the reaped child before signalling any still-running siblings.
    children.delete(child);
    if (!stopping) stop(code ?? (signal ? 1 : 0));
  });
}
process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));
function publicWebEnv() {
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  if (key && !key.startsWith('sb_publishable_')) {
    throw new Error('Use a Supabase publishable key for the public web setting; secret keys are not supported.');
  }
  const inherited={...process.env};delete inherited.GEMINI_API_KEY;delete inherited.GOOGLE_API_KEY;
  return { ...inherited,
    NEXT_PUBLIC_API_BASE_URL: env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1',
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  };
}
async function web(production = false) {
  // The root runner invokes Next directly, bypassing npm workspace predev.
  if (!production) await import('./coding-runtime.mjs');
  // Only these explicit public values from .env are passed to Next.js.
  const webEnv = publicWebEnv();
  run(process.execPath, [webRequire.resolve('next/dist/bin/next'), production ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', env.WEB_PORT ?? '3000'], `${root}apps/web`, webEnv);
}
function api(production = false) {
  const apiEnv = { ...env, SERVER_PORT: env.API_PORT ?? '8080' };
  if (production) run('java', ['-jar', 'build/libs/doezip-api.jar'], `${root}apps/api`, apiEnv);
  else run('./gradlew', ['--no-daemon', 'bootRun'], `${root}apps/api`, apiEnv);
}
switch (process.argv[2]) {
  case 'dev': await web(); api(); break;
  case 'dev:web': await web(); break;
  case 'dev:api': api(); break;
  case 'start:web': await web(true); break;
  case 'build:web': run('npm', ['run', 'build', '-w', 'apps/web'], root, publicWebEnv()); break;
  case 'start:api': api(true); break;
  case 'db:up': run('docker', ['compose', '--env-file', '.env', '-f', 'compose.local.yml', 'up', '-d', '--wait', 'db']); break;
  case 'check:api': run('./gradlew', ['--no-daemon', 'test', 'build'], `${root}apps/api`, {...env,AI_CODING_ENABLED:'false',AI_EVALUATION_ENABLED:'false',GEMINI_API_KEY:''}); break;
  default: throw new Error('Unknown command');
}
