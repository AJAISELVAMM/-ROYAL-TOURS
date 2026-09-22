// =============================================================================
// ogdClient.js — Client helper for Open Government Data (data.gov.in) & public APIs.
// Handles API key authorization, query formatting, response caching, and error safety.
// =============================================================================

import providerCache from './cache.js';
import config from '../../config/env.js';

/**
 * Query an official Government Open Data portal (OGD / data.gov.in).
 * @param {string} resourceId - Dataset / Resource ID
 * @param {object} params - Query filters (format, offset, limit, filters)
 * @param {object} options - Execution options
 * @returns {Promise<Array>} List of records
 */
export async function queryOgd(resourceId, params = {}, { timeoutMs = 7000, cacheKey = null, ttlMs } = {}) {
  const apiKey = config.dataGovInApiKey || process.env.DATA_GOV_IN_API_KEY || process.env.OPEN_DATA_API_KEY || '';

  // If no API key is provided and the OGD portal requires one, gracefully return empty so fallback engages
  if (!apiKey && !params.allowAnonymous) {
    return [];
  }

  if (cacheKey) {
    const cached = providerCache.get('ogd', cacheKey);
    if (cached) return cached;
  }

  const queryParams = new URLSearchParams({
    'api-key': apiKey,
    format: 'json',
    limit: String(params.limit || 50),
    offset: String(params.offset || 0),
    ...params.extra
  });

  const url = `https://api.data.gov.in/resource/${resourceId}?${queryParams.toString()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TourGuard-AI/1.0 (Public Safety & Tourism Assistant)'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[ogdClient] OGD API returned status ${res.status} for resource ${resourceId}`);
      return [];
    }

    const data = await res.json();
    const records = data.records || [];

    if (cacheKey && records.length > 0) {
      providerCache.set('ogd', cacheKey, records, ttlMs);
    }

    return records;
  } catch (err) {
    clearTimeout(timeoutId);
    // eslint-disable-next-line no-console
    console.warn(`[ogdClient] OGD API query failed: ${err.message}`);
    return [];
  }
}
