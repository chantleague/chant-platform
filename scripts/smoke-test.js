const fetch = global.fetch || require('node-fetch');
const endpoints = [
  '/battles',
  '/battle/arsenal-vs-spurs',
  '/battles/arsenal-vs-spurs'
];

const base = process.env.BASE_URL || 'http://localhost:3000';

(async () => {
  let failed = false;
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
