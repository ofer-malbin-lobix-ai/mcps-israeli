/**
 * API client for Israel Airports Authority flight data via data.gov.il CKAN Datastore API.
 */

const BASE_URL = "https://data.gov.il/api/3/action/datastore_search";
const RESOURCE_ID = "e83f763b-b7d7-479e-b172-ae981ddc6de5";

/** A single flight record from the CKAN datastore. */
export interface FlightRecord {
  /** Airline IATA code (e.g. "LY") */
  CHOPER: string;
  /** Flight number (e.g. "1626") */
  CHFLTN: string;
  /** Airline full name in English (e.g. "EL AL ISRAEL AIRLINES") */
  CHOPERD: string;
  /** Scheduled time (ISO 8601) */
  CHSTOL: string;
  /** Actual/estimated time (ISO 8601) */
  CHPTOL: string;
  /** "A" for arrival, "D" for departure */
  CHAORD: string;
  /** Destination/origin IATA airport code (e.g. "EWR") */
  CHLOC1: string;
  /** City name, English full (e.g. "NEW YORK - NEWARK") */
  CHLOC1D: string;
  /** City name, Hebrew */
  CHLOC1TH: string;
  /** City name, English short */
  CHLOC1T: string;
  /** Country name, Hebrew */
  CHLOC1CH: string;
  /** Country name, English */
  CHLOCCT: string;
  /** Terminal number */
  CHTERM: number;
  /** Check-in counters (e.g. "G1-G18") */
  CHCINT: string;
  /** Check-in zone (e.g. "G") */
  CHCKZN: string;
  /** Status in English (e.g. "LANDED", "DEPARTED", "FINAL CALL") */
  CHRMINE: string;
  /** Status in Hebrew */
  CHRMINH: string;
  /** Internal row ID */
  _id: number;
}

/** CKAN Datastore search response shape. */
interface CKANResponse {
  success: boolean;
  result: {
    records: FlightRecord[];
    total: number;
  };
}

/** Parameters for querying the flight datastore. */
export interface SearchParams {
  /** JSON object for exact field matching, e.g. { CHAORD: "A" } */
  filters?: Record<string, string>;
  /** Free-text search across all fields */
  q?: string;
  /** Sort expression, e.g. "CHSTOL desc" */
  sort?: string;
  /** Max records to return (default 100) */
  limit?: number;
}

// Simple rate limiter: max 10 requests per second
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 100; // 10 req/s = 100ms between requests

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Search the Ben Gurion Airport flight datastore.
 */
export async function searchFlights(params: SearchParams = {}): Promise<{
  records: FlightRecord[];
  total: number;
}> {
  await throttle();

  const url = new URL(BASE_URL);
  url.searchParams.set("resource_id", RESOURCE_ID);
  url.searchParams.set("limit", String(params.limit ?? 100));

  if (params.filters && Object.keys(params.filters).length > 0) {
    url.searchParams.set("filters", JSON.stringify(params.filters));
  }

  if (params.q) {
    url.searchParams.set("q", params.q);
  }

  if (params.sort) {
    url.searchParams.set("sort", params.sort);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `data.gov.il API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as CKANResponse;

  if (!data.success) {
    throw new Error("data.gov.il API returned success: false");
  }

  return {
    records: data.result.records,
    total: data.result.total,
  };
}
