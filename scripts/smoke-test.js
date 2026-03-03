const fetch = global.fetch || require('node-fetch');
const endpoints = [
  '/battles',
  '/battle/arsenal-vs-spurs',
  '/battle/man-utd-vs-liverpool',
  '/battle/england-vs-brazil',
  '/clubs',
  '/clubs/arsenal',
  '/clubs/man-utd',
];

// determine base URL auto by probing ports if not overridden
let base = process.env.BASE_URL || 'http://localhost:3000';

async function findWorkingBase() {
  if (process.env.BASE_URL) return base;
  const ports = [3000, 3001, 3002, 3003, 3004];
  for (const port of ports) {
    try {
      const baseTry = `http://localhost:${port}`;
      // check battles and clubs index + sample club to ensure new routes are served
      const r1 = await fetch(`${baseTry}/battles`, { redirect: 'manual' });
      const r2 = await fetch(`${baseTry}/clubs`, { redirect: 'manual' });
      const r3 = await fetch(`${baseTry}/clubs/arsenal`, { redirect: 'manual' });
      if (r1.status === 200 && r2.status === 200 && r3.status === 200) {
        return baseTry;
      }
    } catch (_e) {
      // ignore
    }
  }
  return base;
}

(async () => {
  let failed = false;
  base = await findWorkingBase();
  console.log(`Running smoke tests against ${base}`);
  for (const path of endpoints) {
    const url = base + path;
    try {
      const res = await fetch(url, { redirect: 'manual' });
      console.log(`${path} -> ${res.status} ${res.statusText}`);
      if (res.status !== 200) {
        console.error(`FAIL: ${path} returned ${res.status}`);
        failed = true;
      }
    } catch (err) {
      console.error(`ERROR fetching ${url}:`, err.message || err);
      failed = true;
    }
  }

  if (failed) {
    console.error('Smoke test failed');
    process.exit(1);
  }

  console.log('Smoke test passed');
  process.exit(0);
})();
