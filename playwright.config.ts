import { defineConfig } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
const env = { ...(existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {}), ...process.env };
const webPort = env.WEB_PORT ?? '3000';
const apiPort = env.API_PORT ?? '8080';
const authPort = env.E2E_AUTH_PORT ?? '8799';
const issuer = `http://127.0.0.1:${authPort}`;
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: `http://localhost:${webPort}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'node tests/support/auth-server.mjs', env: { E2E_AUTH_PORT: authPort }, url: `${issuer}/jwks`, reuseExistingServer: false, timeout: 30000, gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 } },
    { command: 'node scripts/run.mjs start:api', env: { AUTH_ENABLED: 'true', AUTH_ISSUER: issuer, AUTH_JWK_SET_URI: `${issuer}/jwks`, AUTH_AUDIENCE: 'authenticated', AUTH_PROVIDER_ID: 'e2e-local', SPRING_PROFILES_ACTIVE: 'local,test' }, url: `http://localhost:${apiPort}/actuator/health`, reuseExistingServer: false, timeout: 120000, gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 } },
    { command: 'node scripts/run.mjs start:web', url: `http://localhost:${webPort}`, reuseExistingServer: false, timeout: 60000, gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 } },
  ],
});
