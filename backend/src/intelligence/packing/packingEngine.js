// =============================================================================
// packingEngine.js — context-aware AI packing recommendation.
//
// Generates a day-wise packing list from the ACTUAL itinerary + contextual
// signals (weather, temperature, rain probability, UV, travel type, season).
// Rules are deterministic and transparent; an LLM provider can be layered on
// top (see packingService) but the context rules always work alone.
//
// Priorities: ESSENTIAL / RECOMMENDED / OPTIONAL. Duplicates are removed.
// =============================================================================

// Activity-type rules. `match` tests the place name + category + activity text.
const RULES = [
  {
    id: 'beach',
    match: /beach|waterfall|water park|kondattam|amusement|swim|splash/i,
    items: [
      { name: 'Sunscreen', priority: 'ESSENTIAL', reason: 'Sun protection during outdoor water activity' },
      { name: 'Sunglasses', priority: 'RECOMMENDED', reason: 'Sun protection outdoors' },
      { name: 'Water bottle', priority: 'ESSENTIAL', reason: 'Stay hydrated in the sun' },
      { name: 'Towel', priority: 'RECOMMENDED', reason: 'Useful after water activities' },
      { name: 'Extra clothes', priority: 'RECOMMENDED', reason: 'You may get wet' },
      { name: 'Waterproof bag', priority: 'RECOMMENDED', reason: 'Keep belongings dry' }
    ]
  },
  {
    id: 'temple',
    match: /temple|vinayagar|pateeswarar|kovil|shrine|church|mosque|worship/i,
    items: [
      { name: 'Comfortable clothing', priority: 'ESSENTIAL', reason: 'Modest attire for temple premises' },
      { name: 'Comfortable footwear', priority: 'RECOMMENDED', reason: 'Easy to remove footwear at entrances' },
      { name: 'ID proof', priority: 'OPTIONAL', reason: 'May be required at some sites' },
      { name: 'Water bottle', priority: 'ESSENTIAL', reason: 'Stay hydrated while exploring' }
    ]
  },
  {
    id: 'hiking',
    match: /trek|hiking|hill|forest|siruvani|nature trail|climb/i,
    items: [
      { name: 'Trekking shoes', priority: 'ESSENTIAL', reason: 'Uneven terrain and long walks' },
      { name: 'Water bottle', priority: 'ESSENTIAL', reason: 'Stay hydrated' },
      { name: 'First-aid essentials', priority: 'ESSENTIAL', reason: 'Basic safety for outdoor trails' },
      { name: 'Jacket / warm clothing', priority: 'RECOMMENDED', reason: 'Hill and forest areas can be cool' },
      { name: 'Sunscreen', priority: 'RECOMMENDED', reason: 'Outdoor sun exposure' }
    ]
  },
  {
    id: 'museum',
    match: /museum|gallery|car museum/i,
    items: [
      { name: 'Comfortable footwear', priority: 'RECOMMENDED', reason: 'Moderate walking indoors' },
      { name: 'ID proof', priority: 'OPTIONAL', reason: 'May be required for entry' },
      { name: 'Water bottle', priority: 'ESSENTIAL', reason: 'Stay hydrated' },
      { name: 'Small backpack', priority: 'RECOMMENDED', reason: 'Carry essentials during the visit' }
    ]
  },
  {
    id: 'park',
    match: /park|zoo|garden|botanical/i,
    items: [
      { name: 'Comfortable walking shoes', priority: 'RECOMMENDED', reason: 'Long walking outdoors' },
      { name: 'Sunglasses', priority: 'RECOMMENDED', reason: 'Sun protection' },
      { name: 'Sunscreen', priority: 'RECOMMENDED', reason: 'Outdoor exposure' },
      { name: 'Water bottle', priority: 'ESSENTIAL', reason: 'Stay hydrated' },
      { name: 'Small backpack', priority: 'OPTIONAL', reason: 'Carry water and essentials' }
    ]
  },
  {
    id: 'photography',
    match: /viewpoint|photo|scenic|sunset|fort|landmark/i,
    items: [
      { name: 'Camera accessories', priority: 'RECOMMENDED', reason: 'Great photo opportunities' },
      { name: 'Power bank', priority: 'RECOMMENDED', reason: 'Keep devices charged' },
      { name: 'Water bottle', priority: 'ESSENTIAL', reason: 'Stay hydrated' }
    ]
  },
  {
    id: 'shopping',
    match: /mall|market|shopping|bazaar|store/i,
    items: [
      { name: 'Reusable bag', priority: 'RECOMMENDED', reason: 'Carry purchases' },
      { name: 'Comfortable footwear', priority: 'RECOMMENDED', reason: 'Extended walking while shopping' },
      { name: 'Small backpack', priority: 'OPTIONAL', reason: 'Keep hands free' }
    ]
  }
];

// Weather/season rules (applied when the forecast says so).
const WEATHER_RULES = [
  {
    id: 'rain',
    match: /rain|shower|drizzle|storm/i,
    items: [
      { name: 'Umbrella', priority: 'ESSENTIAL', reason: 'Rain expected today' },
      { name: 'Raincoat', priority: 'RECOMMENDED', reason: 'Rain expected today' },
      { name: 'Waterproof bag', priority: 'RECOMMENDED', reason: 'Keep belongings dry' }
    ]
  },
  {
    id: 'cold',
    match: /cold|snow|cool/i,
    items: [
      { name: 'Jacket', priority: 'ESSENTIAL', reason: 'Cold weather expected' },
      { name: 'Warm clothing', priority: 'ESSENTIAL', reason: 'Cold weather expected' }
    ]
  },
  {
    id: 'hot',
    match: /hot|sunny|heat/i,
    items: [
      { name: 'Light cotton clothes', priority: 'RECOMMENDED', reason: 'Hot weather expected' },
      { name: 'Sunscreen', priority: 'ESSENTIAL', reason: 'High sun exposure' },
      { name: 'Cap / hat', priority: 'RECOMMENDED', reason: 'Sun protection' }
    ]
  }
];

const GENERIC_ITEMS = [
  { name: 'Water bottle', priority: 'ESSENTIAL', reason: 'Stay hydrated' },
  { name: 'ID proof', priority: 'ESSENTIAL', reason: 'Carry identification' },
  { name: 'Power bank', priority: 'RECOMMENDED', reason: 'Keep your phone charged for navigation' }
];

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = it.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

// Generate a packing list for one day's context (activities, weather, etc.).
export function generateDayItems({ activities = [], weather = {}, temperature, rainProbability, uv, travelType, season }) {
  const items = [];

  const text = activities.map((a) => `${a.title || ''} ${a.category || ''} ${a.type || ''}`).join(' ');
  for (const rule of RULES) {
    if (rule.match.test(text)) {
      items.push(...rule.items);
    }
  }

  const weatherText = `${weather.condition || ''} ${season || ''} ${
    Number(rainProbability) > 40 ? 'rain' : ''
  } ${Number(temperature) != null && Number(temperature) < 15 ? 'cold' : Number(temperature) > 30 ? 'hot' : ''}`;
  for (const rule of WEATHER_RULES) {
    if (rule.match.test(weatherText)) items.push(...rule.items);
  }

  // Always add the generic travel essentials.
  items.push(...GENERIC_ITEMS);

  return dedupe(items);
}

// Build a full day-wise packing plan for an itinerary.
// itinerary: [{ day, activities: [{title, category, type}] }]
export function generatePackingPlan({ itinerary = [], weather = {}, temperature, rainProbability, uv, travelType, season, durationDays }) {
  const days = durationDays || itinerary.length || 1;
  const plan = [];

  for (let d = 1; d <= days; d++) {
    const day = (itinerary || []).find((x) => x.day === d) || { day: d, activities: [] };
    const activities = day.activities || [];
    const items = generateDayItems({ activities, weather, temperature, rainProbability, uv, travelType, season });

    const reason = describeDay(items, activities);
    plan.push({ day: d, reason, items });
  }

  return plan;
}

function describeDay(items, activities) {
  const kinds = [...new Set(items.map((i) => i.priority))];
  const essential = kinds.includes('ESSENTIAL');
  if (activities.length === 0) return 'Recommended for a travel / free day.';
  const activityType = activities.map((a) => a.category || a.title).filter(Boolean).slice(0, 2).join(', ');
  return `Recommended for ${activityType || 'your planned activities'}${essential ? ' (essentials included)' : ''}.`;
}
