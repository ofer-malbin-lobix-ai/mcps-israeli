/**
 * API client for data.gov.il CKAN DataStore (election results).
 */

const BASE_URL = "https://data.gov.il/api/3/action";

/** Minimum delay between requests (ms). */
const THROTTLE_MS = 200;
let lastRequestTime = 0;

/**
 * Resource IDs for Knesset election results on data.gov.il.
 */
export const RESOURCES: Record<
  number,
  { bySettlement: string; byBallot?: string }
> = {
  25: {
    bySettlement: "b392b8ee-ba45-4ea0-bfed-f03a1a36e99c",
    byBallot: "cc223336-07bc-485d-b160-62df92967c0a",
  },
  24: {
    bySettlement: "9921a347-8466-4ef4-81f9-22523c5c4632",
    byBallot: "419be3b0-fd30-455a-afc0-034ec36be990",
  },
  23: {
    bySettlement: "3dc36e20-25d6-4496-ba6a-71d9bc917349",
  },
};

export const SUPPORTED_KNESSETS = [23, 24, 25] as const;
export type KnessetNumber = (typeof SUPPORTED_KNESSETS)[number];

interface DataStoreSearchParams {
  resourceId: string;
  filters?: Record<string, unknown>;
  q?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  fields?: string;
}

export interface DataStoreRecord {
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
  url.searchParams.set("resource_id", params.resourceId);

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

/**
 * Get the settlement resource ID for a given Knesset number.
 */
export function getSettlementResourceId(knesset: KnessetNumber): string {
  return RESOURCES[knesset].bySettlement;
}
