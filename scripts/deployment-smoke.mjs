const web = required('DEPLOY_WEB_URL');
const api = required('DEPLOY_API_URL');

function required(name) {
  const value = process.env[name]?.replace(/\/$/, '');
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function request(label, url, expected, init) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(70_000), ...init });
  if (!expected.includes(response.status)) throw new Error(`${label}: expected ${expected.join('/')} but received ${response.status}`);
  console.log(`${label}: ${response.status}`);
  return response;
}

await request('web learning page', `${web}/learn`, [200]);
const health = await request('api database health', `${api}/actuator/health`, [200]);
const healthBody = await health.json();
if (healthBody.status !== 'UP' || Object.keys(healthBody).some(key => key !== 'status')) throw new Error('health response must expose only status UP');

const tasks = await request('public task catalog', `${api}/api/v1/tasks`, [200]);
const taskBody = await tasks.json();
if (!Array.isArray(taskBody.items) || !taskBody.items.some(task => task.id === '71111111-1111-4111-8111-111111111111')) throw new Error('reviewed demo task is missing');

await request('protected current user', `${api}/api/v1/me`, [401]);
const preflight = await request('web origin CORS', `${api}/api/v1/tasks`, [200, 204], {
  method: 'OPTIONS',
  headers: { Origin: web, 'Access-Control-Request-Method': 'GET' },
});
if (preflight.headers.get('access-control-allow-origin') !== web) throw new Error('CORS does not allow the deployed web origin');

console.log('Deployment smoke passed. Google OAuth and Gemini still require an authenticated browser check.');
