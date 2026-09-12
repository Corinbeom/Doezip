import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Verification must never contact a developer's live OAuth project.
const env = { ...process.env, AUTH_ENABLED: 'false', AI_EVALUATION_ENABLED: 'false', GEMINI_API_KEY: '',
  NEXT_PUBLIC_SUPABASE_URL: 'https://e2e-auth.invalid',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e_test_only' };
const cwd = fileURLToPath(new URL('../', import.meta.url));
let child;
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  stopping = true;
  if (child) { try { process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
  process.exitCode = 1;
});
function run(args, executable = 'npm') {
  return new Promise((resolve, reject) => {
    if (stopping) { reject(new Error('Verification interrupted')); return; }
    child = spawn(executable, args, { cwd, env, stdio: 'inherit', detached: true });
    child.once('error', reject);
    child.once('exit', code => { child = undefined; code === 0 ? resolve() : reject(new Error(`Verification command failed (${code})`)); });
  });
}
try {
  if (process.argv[2] === 'check') {
    for (const command of ['api:check', 'check:web', 'check:api']) await run(['run', command]);
  } else if (process.argv[2] === 'e2e') {
    await run(['scripts/run.mjs', 'build:web'], process.execPath);
  } else throw new Error('Expected check or e2e');
  await run(['exec', '--', 'playwright', 'test']);
} catch (error) { console.error(error.message); process.exitCode = 1; }
