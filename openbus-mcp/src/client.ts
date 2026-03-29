const BASE_URL = "https://open-bus-stride-api.hasadna.org.il";

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1000; // 1 request per second

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  const waitMs = MIN_INTERVAL_MS - elapsed;
  lastRequestTime = waitMs > 0 ? now + waitMs : now;
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

export interface ApiError {
  status: number;
  statusText: string;
  body: string;
}

export async function fetchApi(
  path: string,
  params: Record<string, string | number | boolean | undefined>
): Promise<unknown> {
  await rateLimit();

  const url = new URL(path, BASE_URL);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    const error: ApiError = {
      status: response.status,
      statusText: response.statusText,
      body,
    };
    throw error;
  }

  return response.json();
}
