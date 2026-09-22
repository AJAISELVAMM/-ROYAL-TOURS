// =============================================================================
// weatherService.js — weather service calling weatherProvider.
// =============================================================================

import { fetchLiveWeather } from '../providers/weatherProvider.js';
import { geocode } from '../providers/geocodingProvider.js';
import { badRequest, serviceUnavailable } from '../utils/errors.js';

export async function getWeather({ latitude, longitude, city }) {
  let lat = latitude != null ? Number(latitude) : null;
  let lon = longitude != null ? Number(longitude) : null;

  if ((lat == null || lon == null) && city && typeof city === 'string' && city.trim()) {
    try {
      const geo = await geocode(city.trim());
      if (geo && geo.lat != null && geo.lon != null) {
        lat = Number(geo.lat);
        lon = Number(geo.lon);
      }
    } catch {
      // Continue to validation
    }
  }

  if (lat == null || lon == null) {
    throw badRequest('Latitude and longitude (or valid city name) are required for live weather.');
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw badRequest('Invalid coordinates provided.');
  }

  try {
    const weather = await fetchLiveWeather(lat, lon);
    return {
      ...weather,
      city: city || weather.city || null
    };
  } catch {
    throw serviceUnavailable('Live weather service is temporarily unavailable. Please try again in a moment.', 'WEATHER_UNAVAILABLE');
  }
}
