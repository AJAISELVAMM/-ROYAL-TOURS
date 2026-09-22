import { searchByCategory } from './src/providers/index.js';

const CITIES = [
  { name: 'Sathyamangalam', lat: 11.5034, lon: 77.2444 },
  { name: 'Coimbatore', lat: 11.0168, lon: 76.9558 },
  { name: 'Erode', lat: 11.3410, lon: 77.7172 },
  { name: 'Madurai', lat: 9.9252, lon: 78.1198 },
  { name: 'Salem', lat: 11.6643, lon: 78.1460 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Ooty', lat: 11.4102, lon: 76.6950 }
];

const CATS = ['places', 'hotels', 'restaurants', 'theatres', 'shopping'];

async function testAll() {
  for (const city of CITIES) {
    console.log(`\n=================== ${city.name} (${city.lat}, ${city.lon}) ===================`);
    for (const cat of CATS) {
      try {
        const t0 = Date.now();
        const results = await searchByCategory(cat, {
          latitude: city.lat,
          longitude: city.lon,
          radius: 60000,
          limit: 10
        });
        const elapsed = Date.now() - t0;
        console.log(`  ${cat.padEnd(12)}: count=${results.length} (${elapsed}ms)`);
        if (results.length > 0) {
          console.log(`    Sample: "${results[0].name}" [${results[0].distanceKm}km away]`);
        }
      } catch (err) {
        console.log(`  ${cat.padEnd(12)}: ERROR: ${err.message}`);
      }
    }
  }
}

testAll().catch(console.error);
