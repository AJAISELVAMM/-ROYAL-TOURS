
const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

async function testEndpoint(ep) {
  const t0 = Date.now();
  const q = `[out:json][timeout:10];node["amenity"="cinema"](around:20000,11.0168,76.9558);out tags;`;
  try {
    const res = await fetch(ep, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TourGuard-AI/1.0 (https://tourguard.ai; admin@tourguard.ai)'
      },
      body: `data=${encodeURIComponent(q)}`,
      timeout: 8000
    });
    const json = await res.json();
    console.log(`${ep}: status=${res.status}, elements=${json.elements?.length || 0} in ${Date.now() - t0}ms`);
  } catch (err) {
    console.log(`${ep}: ERROR ${err.message} in ${Date.now() - t0}ms`);
  }
}

async function run() {
  for (const ep of OVERPASS_ENDPOINTS) {
    await testEndpoint(ep);
  }
}

run();
