import { searchHotels } from './src/providers/hotelProvider.js';
import { searchRestaurants } from './src/providers/restaurantProvider.js';
import { searchAttractions } from './src/providers/attractionProvider.js';
import { searchShopping } from './src/providers/shoppingProvider.js';

async function testLocation(name, lat, lon) {
  console.log(`\n================== ${name} (${lat}, ${lon}) ==================`);
  
  const places = await searchAttractions({ latitude: lat, longitude: lon, radius: 15000, limit: 5 });
  console.log(`Places (${places.length}):`, places.map(p => `${p.name} (${p.distanceKm} km, ⭐ ${p.rating || 'N/A'})`));

  const hotels = await searchHotels({ latitude: lat, longitude: lon, radius: 10000, limit: 5 });
  console.log(`Hotels (${hotels.length}):`, hotels.map(h => `${h.name} (${h.distanceKm} km, ⭐ ${h.rating || 'N/A'})`));

  const restaurants = await searchRestaurants({ latitude: lat, longitude: lon, radius: 8000, limit: 5 });
  console.log(`Restaurants (${restaurants.length}):`, restaurants.map(r => `${r.name} (${r.distanceKm} km, ⭐ ${r.rating || 'N/A'})`));

  const shopping = await searchShopping({ latitude: lat, longitude: lon, radius: 10000, limit: 5 });
  console.log(`Shopping (${shopping.length}):`, shopping.map(s => `${s.name} (${s.distanceKm} km, ⭐ ${s.rating || 'N/A'})`));
}

await testLocation('Madurai', 9.926, 78.114);
await testLocation('Sathyamangalam', 11.5034, 77.2344);
await testLocation('Erode', 11.3410, 77.7172);
