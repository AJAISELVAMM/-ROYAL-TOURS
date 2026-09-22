// =============================================================================
// weatherProvider.js — Real Weather Provider using Open-Meteo (Free, No Key Required).
// Fetches live atmospheric metrics based on tourist's actual latitude/longitude.
// =============================================================================

import providerCache from './base/cache.js';

const WMO_CODE_MAP = {
  0: { description: 'Clear sky', icon: 'sun' },
  1: { description: 'Mainly clear', icon: 'cloud-sun' },
  2: { description: 'Partly cloudy', icon: 'cloud-sun' },
  3: { description: 'Overcast', icon: 'cloud' },
  45: { description: 'Foggy', icon: 'cloud' },
  48: { description: 'Depositing rime fog', icon: 'cloud' },
  51: { description: 'Light drizzle', icon: 'cloud-rain' },
  53: { description: 'Moderate drizzle', icon: 'cloud-rain' },
  55: { description: 'Dense drizzle', icon: 'cloud-rain' },
  61: { description: 'Slight rain', icon: 'cloud-rain' },
  63: { description: 'Moderate rain', icon: 'cloud-rain' },
  65: { description: 'Heavy rain', icon: 'cloud-rain' },
  71: { description: 'Slight snow', icon: 'cloud' },
  73: { description: 'Moderate snow', icon: 'cloud' },
  75: { description: 'Heavy snow', icon: 'cloud' },
  80: { description: 'Rain showers', icon: 'cloud-rain' },
  81: { description: 'Moderate rain showers', icon: 'cloud-rain' },
  82: { description: 'Violent rain showers', icon: 'cloud-rain' },
  95: { description: 'Thunderstorm', icon: 'cloud-rain' },
  96: { description: 'Thunderstorm with hail', icon: 'cloud-rain' },
  99: { description: 'Heavy thunderstorm with hail', icon: 'cloud-rain' }
};

export async function fetchLiveWeather(latitude, longitude) {
  if (latitude == null || longitude == null) {
    throw new Error('Latitude and longitude are required for live weather.');
  }

  const lat = Number(latitude);
  const lon = Number(longitude);
  const cacheKey = `weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = providerCache.get('weather', cacheKey);
  if (cached) return cached;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }

    const data = await res.json();
    const current = data.current || {};
    const daily = data.daily || {};

    const weatherCode = current.weather_code ?? 0;
    const wmoInfo = WMO_CODE_MAP[weatherCode] || { description: 'Fair', icon: 'cloud-sun' };

    // Parse 5-day daily forecast
    const forecast = (daily.time || []).slice(0, 5).map((dateStr, idx) => {
      const d = new Date(dateStr);
      const dayName = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const code = daily.weather_code?.[idx] ?? 0;
      const fWmo = WMO_CODE_MAP[code] || { description: 'Fair', icon: 'cloud-sun' };

      return {
        day: dayName,
        date: dateStr,
        icon: fWmo.icon,
        cond: fWmo.description,
        high: Math.round(daily.temperature_2m_max?.[idx] ?? current.temperature_2m),
        low: Math.round(daily.temperature_2m_min?.[idx] ?? current.temperature_2m),
        rainProbability: daily.precipitation_probability_max?.[idx] ?? 0,
        uvMax: daily.uv_index_max?.[idx] ?? 0
      };
    });

    // UV Index classification
    const uvVal = current.uv_index ?? 0;
    const uvDescription = uvVal < 3 ? 'Low' : uvVal < 6 ? 'Moderate' : uvVal < 8 ? 'High' : 'Very High';

    // Contextual AI insights interpreting real weather data
    const recommendations = [];
    const temp = current.temperature_2m ?? 28;
    const rainProb = daily.precipitation_probability_max?.[0] ?? (current.rain > 0 ? 80 : 10);

    if (rainProb > 50 || current.precipitation > 0) {
      recommendations.push({
        type: 'rain',
        icon: 'cloud-rain',
        title: 'Rain / Showers expected',
        description: `Carrying an umbrella or raincoat is advised (rain probability ~${rainProb}%). Indoor museums, art galleries, and cafes are great alternatives during peak rain.`
      });
    } else if (temp > 33) {
      recommendations.push({
        type: 'hot',
        icon: 'sun',
        title: 'High temperature alert',
        description: `Stay hydrated and wear sunscreen. Ideal for outdoor sightseeing in early mornings and evenings.`
      });
    } else {
      recommendations.push({
        type: 'sun',
        icon: 'sun',
        title: 'Pleasant sightseeing weather',
        description: `Great conditions for outdoor monuments, parks, and walking tours throughout the day.`
      });
    }

    if (uvVal >= 6) {
      recommendations.push({
        type: 'uv',
        icon: 'sparkles',
        title: 'Elevated UV index',
        description: `UV index is ${uvDescription} (${uvVal.toFixed(1)}). Wear sunglasses, a hat, and UV-protective clothing if exploring outdoors between 11 AM and 3 PM.`
      });
    } else {
      recommendations.push({
        type: 'indoor',
        icon: 'building',
        title: 'Flexible travel conditions',
        description: `Both indoor shopping arcades and scenic viewpoints have favorable visiting windows today.`
      });
    }

    const result = {
      latitude: lat,
      longitude: lon,
      temperature: Math.round(current.temperature_2m ?? 25),
      feelsLike: Math.round(current.apparent_temperature ?? current.temperature_2m ?? 25),
      humidity: Math.round(current.relative_humidity_2m ?? 60),
      windSpeedKm: Math.round(current.wind_speed_10m ?? 10),
      windDirection: current.wind_direction_10m ?? 0,
      precipitation: current.precipitation ?? 0,
      rain: current.rain ?? 0,
      uvIndex: uvVal,
      uvDescription,
      weatherCode,
      condition: wmoInfo.description,
      icon: wmoInfo.icon,
      isDay: Boolean(current.is_day),
      forecast,
      recommendations,
      source: 'open_meteo'
    };

    // Cache weather for 15 minutes
    providerCache.set('weather', cacheKey, result, 15 * 60 * 1000);
    return result;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[weatherProvider] Open-Meteo failed (${err.message}). Falling back to wttr.in live service...`);
    
    // Live failover: wttr.in provides real-time meteorological conditions without rate-limiting
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const fallbackRes = await fetch(`https://wttr.in/${lat},${lon}?format=j1`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (fallbackRes.ok) {
        const fbData = await fallbackRes.json();
        const cur = fbData.current_condition?.[0] || {};
        const weatherList = fbData.weather || [];
        const desc = cur.weatherDesc?.[0]?.value?.trim() || 'Fair';
        const temp = parseInt(cur.temp_C, 10) || 25;
        const feelsLike = parseInt(cur.FeelsLikeC, 10) || temp;
        const humidity = parseInt(cur.humidity, 10) || 60;
        const windKm = parseInt(cur.windspeedKmph, 10) || 10;
        const uv = parseInt(cur.uvIndex, 10) || 0;
        const precip = parseFloat(cur.precipMM) || 0;

        const forecast = weatherList.slice(0, 5).map((w, idx) => {
          const d = new Date(w.date);
          const dayName = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
          const cond = w.hourly?.[4]?.weatherDesc?.[0]?.value?.trim() || desc;
          return {
            day: dayName,
            date: w.date,
            icon: cond.toLowerCase().includes('rain') ? 'cloud-rain' : cond.toLowerCase().includes('cloud') ? 'cloud-sun' : 'sun',
            cond,
            high: parseInt(w.maxtempC, 10) || temp,
            low: parseInt(w.mintempC, 10) || temp,
            rainProbability: parseInt(w.hourly?.[4]?.chanceofrain, 10) || (precip > 0 ? 70 : 10),
            uvMax: parseInt(w.uvIndex, 10) || uv
          };
        });

        const isRain = desc.toLowerCase().includes('rain') || precip > 0;
        const recommendations = [
          isRain
            ? { type: 'rain', icon: 'cloud-rain', title: 'Rain expected', description: 'Carrying an umbrella is advised. Consider indoor attractions.' }
            : temp > 33
            ? { type: 'hot', icon: 'sun', title: 'Warm outdoor temperatures', description: 'Stay hydrated and use sunscreen when exploring outdoors.' }
            : { type: 'sun', icon: 'sun', title: 'Pleasant sightseeing weather', description: 'Comfortable conditions for outdoor monuments, parks, and walking tours.' }
        ];

        const fallbackResult = {
          latitude: lat,
          longitude: lon,
          temperature: temp,
          feelsLike,
          humidity,
          windSpeedKm: windKm,
          windDirection: parseInt(cur.winddirDegree, 10) || 0,
          precipitation: precip,
          rain: precip,
          uvIndex: uv,
          uvDescription: uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : 'Very High',
          weatherCode: parseInt(cur.weatherCode, 10) || 0,
          condition: desc,
          icon: isRain ? 'cloud-rain' : desc.toLowerCase().includes('cloud') ? 'cloud-sun' : 'sun',
          isDay: true,
          forecast,
          recommendations,
          source: 'wttr'
        };

        providerCache.set('weather', cacheKey, fallbackResult, 15 * 60 * 1000);
        return fallbackResult;
      }
    } catch (fbErr) {
      // eslint-disable-next-line no-console
      console.warn(`[weatherProvider] Fallback wttr.in request also failed: ${fbErr.message}`);
    }

    throw err;
  }
}
