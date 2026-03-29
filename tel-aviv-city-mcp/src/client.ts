/**
 * HTTP client for Tel Aviv Municipality ArcGIS REST services.
 * Handles rate limiting, retries, and query construction.
 */

const BASE_URL =
  "https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer";

/** Minimum milliseconds between requests (client-side rate limit). */
const MIN_REQUEST_INTERVAL_MS = 200;

/** Maximum number of retry attempts for transient failures. */
const MAX_RETRIES = 2;

/** Request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 15_000;

let lastRequestTime = 0;

/**
 * Waits if necessary to respect the client-side rate limit.
 */
async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();
}

// ---------------------------------------------------------------------------
// ArcGIS types
// ---------------------------------------------------------------------------

export interface ArcGISFeature {
  attributes: Record<string, unknown>;
  geometry?: { x: number; y: number } | { rings: number[][][] } | { paths: number[][][] };
}

export interface ArcGISQueryResponse {
  features: ArcGISFeature[];
  exceededTransferLimit?: boolean;
  error?: { code: number; message: string; details: string[] };
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export interface QueryOptions {
  layerId: number;
  where?: string;
  outFields?: string[];
  /** Bounding box in WGS-84: [xmin, ymin, xmax, ymax] */
  bbox?: [number, number, number, number];
  /** Maximum features to return (server default is 1000). */
  resultRecordCount?: number;
  /** Return geometry in WGS-84 (EPSG 4326). */
  returnGeometry?: boolean;
  orderByFields?: string;
}

/**
 * Queries an ArcGIS MapServer layer and returns features.
 */
export async function queryLayer(
  options: QueryOptions
): Promise<ArcGISFeature[]> {
  const {
    layerId,
    where = "1=1",
    outFields = ["*"],
    bbox,
    resultRecordCount = 100,
    returnGeometry = true,
    orderByFields,
  } = options;

  const params = new URLSearchParams({
    where,
    outFields: outFields.join(","),
    f: "json",
    resultRecordCount: String(resultRecordCount),
    returnGeometry: String(returnGeometry),
    outSR: "4326",
  });

  if (bbox) {
    params.set("geometry", bbox.join(","));
    params.set("geometryType", "esriGeometryEnvelope");
    params.set("inSR", "4326");
    params.set("spatialRel", "esriSpatialRelIntersects");
  }

  if (orderByFields) {
    params.set("orderByFields", orderByFields);
  }

  const url = `${BASE_URL}/${layerId}/query?${params.toString()}`;

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await throttle();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = (await res.json()) as ArcGISQueryResponse;

      if (data.error) {
        throw new Error(
          `ArcGIS error ${data.error.code}: ${data.error.message}`
        );
      }

      return data.features ?? [];
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error("Query failed after retries");
}

// ---------------------------------------------------------------------------
// Layer ID constants
// ---------------------------------------------------------------------------

/** Well-known layer IDs in the IView2 MapServer. */
export const LAYERS = {
  /** Public parking lots */
  PUBLIC_PARKING: 556,
  /** Ahuzot HaHof (municipal) parking lots with pricing info */
  AHUZOT_PARKING: 970,
  /** Tel-O-Fun bike-sharing stations */
  BIKE_STATIONS: 835,
  /** Road works / closures (line features) */
  ROAD_WORKS: 852,
  /** Road works - point features */
  ROAD_WORKS_POINT: 853,
  /** Pharmacies */
  PHARMACIES: 564,
  /** Schools (current year) */
  SCHOOLS: 769,
  /** Public parks and green spaces */
  PARKS: 551,
  /** Community centers (includes libraries) */
  COMMUNITY_CENTERS: 553,
  /** Culture institutions (museums, theaters, galleries) */
  CULTURE: 745,
  /** Playgrounds */
  PLAYGROUNDS: 696,
  /** Medical institutions */
  MEDICAL: 565,
  /** Health clinics (Kupot Holim) */
  HEALTH_CLINICS: 563,
  /** Neighborhoods */
  NEIGHBORHOODS: 511,
} as const;

// ---------------------------------------------------------------------------
// Geo utilities
// ---------------------------------------------------------------------------

/**
 * Creates a bounding box around a WGS-84 point.
 * @param lon Longitude
 * @param lat Latitude
 * @param radiusKm Radius in kilometers
 * @returns [xmin, ymin, xmax, ymax]
 */
export function bboxAroundPoint(
  lon: number,
  lat: number,
  radiusKm: number
): [number, number, number, number] {
  // Rough conversion: 1 degree latitude ~ 111 km
  const dLat = radiusKm / 111;
  // 1 degree longitude varies by latitude
  const dLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

/**
 * Calculates the Haversine distance in km between two WGS-84 points.
 */
export function haversineKm(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
