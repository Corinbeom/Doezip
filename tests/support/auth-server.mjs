// Local test fixture issuer only. Never imported into the application or used by dev.
import { createServer } from 'node:http';
import { generateKeyPairSync, sign } from 'node:crypto';
const port = Number(process.env.E2E_AUTH_PORT ?? 8799);
const issuer = `http://127.0.0.1:${port}`;
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'e2e-key', alg: 'RS256', use: 'sig' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const subjects = { alice: '71111111-1111-4111-8111-111111111111', bob: '72222222-2222-4222-8222-222222222222' };
const server = createServer((req, res) => {
  const url = new URL(req.url, issuer);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/jwks') return res.end(JSON.stringify({ keys: [jwk] }));
  const subject = subjects[url.searchParams.get('user')];
  if (url.pathname !== '/session' || !subject) { res.statusCode = 404; return res.end('{}'); }
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: subject, aud: 'authenticated', role: 'authenticated', email: `${url.searchParams.get('user')}@example.invalid`, app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { full_name: '테스트 학습자' }, created_at: '2026-09-11T00:00:00Z' };
  const payload = `${encode({ alg: 'RS256', kid: 'e2e-key', typ: 'JWT' })}.${encode({ iss: issuer, sub: subject, aud: 'authenticated', exp: expires, role: 'authenticated', is_anonymous: false, email: user.email, user_metadata: user.user_metadata })}`;
  const access_token = `${payload}.${sign('RSA-SHA256', Buffer.from(payload), privateKey).toString('base64url')}`;
  res.end(JSON.stringify({ access_token, token_type: 'bearer', expires_in: 3600, expires_at: expires, refresh_token: 'local-test-not-refreshable', user }));
});
server.listen(port, '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
