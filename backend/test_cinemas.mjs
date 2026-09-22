
const q = `[out:json][timeout:15];
(
  node["amenity"~"^(cinema|theatre)$"](around:60000,11.341,77.7172);
  way["amenity"~"^(cinema|theatre)$"](around:60000,11.341,77.7172);
);
out center tags 30;`;

async function test() {
  const mirrors = [
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  for (const m of mirrors) {
    const t0 = Date.now();
    try {
      const res = await fetch(m, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TourGuard-App/1.0 (https://tourguard.ai; dev@tourguard.ai)',
          'From': 'dev@tourguard.ai'
        },
        body: `data=${encodeURIComponent(q)}`
      });
      const data = await res.json();
      console.log(`${m}: returned ${data.elements?.length || 0} in ${Date.now() - t0}ms`);
      if (data.elements?.length > 0) {
        console.log('Sample:', data.elements[0].tags?.name);
      }
    } catch (e) {
      console.log(`${m}: FAILED in ${Date.now() - t0}ms: ${e.message}`);
    }
  }
}

test();
