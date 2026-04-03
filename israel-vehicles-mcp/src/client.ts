/**
 * API client for data.gov.il CKAN DataStore.
 */

const BASE_URL = "https://data.gov.il/api/3/action";
const RESOURCE_ID = "053cea08-09bc-40ec-8f7a-156f0677aff3";

/** Minimum delay between requests (ms). */
const THROTTLE_MS = 200;
let lastRequestTime = 0;

interface DataStoreSearchParams {
  filters?: Record<string, unknown>;
  q?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  fields?: string;
}

interface DataStoreRecord {
  [key: string]: unknown;
}

interface DataStoreResult {
  records: DataStoreRecord[];
  total: number;
  fields: Array<{ id: string; type: string }>;
}

interface DataStoreResponse {
  success: boolean;
  result: DataStoreResult;
}

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < THROTTLE_MS) {
    await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export async function datastoreSearch(
  params: DataStoreSearchParams
): Promise<DataStoreResult> {
  await throttle();

  const url = new URL(`${BASE_URL}/datastore_search`);
  url.searchParams.set("resource_id", RESOURCE_ID);

  if (params.filters) {
    url.searchParams.set("filters", JSON.stringify(params.filters));
  }
  if (params.q !== undefined) {
    url.searchParams.set("q", params.q);
  }
  if (params.limit !== undefined) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    url.searchParams.set("offset", String(params.offset));
  }
  if (params.sort) {
    url.searchParams.set("sort", params.sort);
  }
  if (params.fields) {
    url.searchParams.set("fields", params.fields);
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `data.gov.il API returned ${response.status}: ${body.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as DataStoreResponse;
  if (!data.success) {
    throw new Error("data.gov.il API returned success=false");
  }

  return data.result;
}

export { RESOURCE_ID };
export type { DataStoreRecord, DataStoreResult };
