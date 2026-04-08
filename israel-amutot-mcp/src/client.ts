const BASE_URL = "https://data.gov.il/api/3/action";

// Resource IDs from the moj-amutot dataset on data.gov.il
export const RESOURCES = {
  /** Registered amutot (74,880+ records) */
  amutot: "be5b7935-3922-45d4-9638-08871b17ec95",
  /** Foreign political entity donations (13,300+ records) */
  foreignDonations: "35cb40b5-3f13-4bca-9ce2-488085913107",
  /** Proper management certificate history (324,500+ records) */
  managementCertificate: "cb12ac14-7429-4268-bc03-460f48157858",
  /** Public benefit companies / חל"צ (1,500 records) */
  publicBenefitCompanies: "85e40960-5426-4f4c-874f-2d1ec1b94609",
} as const;

const TIMEOUT_MS = 30_000;
const THROTTLE_MS = 200;

let lastRequestTime = 0;

interface DatastoreSearchParams {
  resourceId: string;
  q?: string;
  filters?: Record<string, string | number>;
  limit?: number;
  offset?: number;
  fields?: string[];
  sort?: string;
}

interface DatastoreSearchResult {
  success: boolean;
  result: {
    records: Record<string, unknown>[];
    total: number;
    fields: { id: string; type: string }[];
  };
}

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  const wait = THROTTLE_MS - elapsed;
  lastRequestTime = now + (wait > 0 ? wait : 0);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

export async function datastoreSearch(
  params: DatastoreSearchParams
): Promise<DatastoreSearchResult> {
  await throttle();

  const url = new URL(`${BASE_URL}/datastore_search`);
  url.searchParams.set("resource_id", params.resourceId);

  if (params.q) {
    url.searchParams.set("q", params.q);
  }
  if (params.filters) {
    url.searchParams.set("filters", JSON.stringify(params.filters));
  }
  if (params.limit !== undefined) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    url.searchParams.set("offset", String(params.offset));
  }
  if (params.fields && params.fields.length > 0) {
    url.searchParams.set("fields", params.fields.join(","));
  }
  if (params.sort) {
    url.searchParams.set("sort", params.sort);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `data.gov.il API error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`
    );
  }

  const data = (await response.json()) as DatastoreSearchResult;

  if (!data.success) {
    throw new Error("data.gov.il API returned success=false");
  }

  return data;
}
