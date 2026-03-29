/**
 * HTTP client for the Israel Hiking Map API (israelhiking.osm.org.il).
 *
 * Implements client-side rate limiting and timeout handling to be
 * respectful to the open-source server.
 */

const BASE_URL = "https://israelhiking.osm.org.il";
const REQUEST_TIMEOUT_MS = 30_000;
const MIN_REQUEST_INTERVAL_MS = 500;

let lastRequestTime = 0;

async function rateLimitedFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "israel-hiking-mcp/1.0.0",
        ...(init?.headers ?? {}),
      },
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  source: string;
  title: string;
  displayName: string;
  icon: string;
  iconColor: string;
  location: { lat: number; lng: number; alt: number | null };
  hasExtraData: boolean;
}

export interface RoutingFeatureCollection {
  type: "FeatureCollection";
  features: RoutingFeature[];
}

export interface RoutingFeature {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: number[][]; // [lng, lat, elevation]
  };
  properties: {
    details?: {
      road_class?: Array<[number, number, string]>;
      track_type?: Array<[number, number, string]>;
    };
    Name?: string;
    Creator?: string;
    [key: string]: unknown;
  };
}

export interface PoiFeature {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
  properties: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * Search for points of interest by term.
 * GET /api/search/{term}?language={language}
 */
export async function searchPois(
  term: string,
  language: string = "he"
): Promise<SearchResult[]> {
  const encodedTerm = encodeURIComponent(term);
  const url = `${BASE_URL}/api/search/${encodedTerm}?language=${encodeURIComponent(language)}`;
  const response = await rateLimitedFetch(url);
  if (!response.ok) {
    throw new Error(
      `Search failed (HTTP ${response.status}): ${await response.text()}`
    );
  }
  return (await response.json()) as SearchResult[];
}

/**
 * Plan a route between two points.
 * GET /api/routing?from={lat},{lng}&to={lat},{lng}&type={Hike|Bike|4WD|None}
 */
export async function planRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  type: string = "Hike"
): Promise<RoutingFeatureCollection> {
  const url = `${BASE_URL}/api/routing?from=${fromLat},${fromLng}&to=${toLat},${toLng}&type=${encodeURIComponent(type)}`;
  const response = await rateLimitedFetch(url);
  if (!response.ok) {
    throw new Error(
      `Routing failed (HTTP ${response.status}): ${await response.text()}`
    );
  }
  return (await response.json()) as RoutingFeatureCollection;
}

/**
 * Get details for a specific POI.
 * GET /api/points/{source}/{id}
 */
export async function getPoiDetails(
  source: string,
  id: string
): Promise<PoiFeature> {
  const url = `${BASE_URL}/api/points/${encodeURIComponent(source)}/${encodeURIComponent(id)}`;
  const response = await rateLimitedFetch(url);
  if (!response.ok) {
    throw new Error(
      `POI details failed (HTTP ${response.status}): ${await response.text()}`
    );
  }
  return (await response.json()) as PoiFeature;
}

/**
 * Get the closest point of interest to a location.
 * GET /api/points/closest?location={lat},{lng}&source={source}&language={language}
 */
export async function getClosestPoint(
  lat: number,
  lng: number,
  source: string = "",
  language: string = "he"
): Promise<PoiFeature> {
  const url = `${BASE_URL}/api/points/closest?location=${lat},${lng}&source=${encodeURIComponent(source)}&language=${encodeURIComponent(language)}`;
  const response = await rateLimitedFetch(url);
  if (!response.ok) {
    throw new Error(
      `Closest point failed (HTTP ${response.status}): ${await response.text()}`
    );
  }
  return (await response.json()) as PoiFeature;
}
