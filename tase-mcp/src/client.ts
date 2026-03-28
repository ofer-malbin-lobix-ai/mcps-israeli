/**
 * TASE Data Hub API Client
 *
 * Wraps the official TASE API with authentication, rate limiting, and error handling.
 * API docs: https://openapi.tase.co.il/tase/prod/
 */

// Base URL from the official TASE Data Hub API Guide PDF (curl example on page 7).
// The "tst" in the subdomain appears in the official docs; may be test or production.
// Update if TASE publishes a different production URL.
const BASE_URL = "https://datawisetst.tase.co.il";

// Simple sliding window rate limiter: max 5 requests per second (conservative; official limit is 10/2s)
const MAX_REQUESTS = 5;
const WINDOW_MS = 1000;
const timestamps: number[] = [];

async function rateLimit(): Promise<void> {
  const now = Date.now();

  // Remove timestamps outside the window
  while (timestamps.length > 0 && timestamps[0]! <= now - WINDOW_MS) {
    timestamps.shift();
  }

  if (timestamps.length >= MAX_REQUESTS) {
    const oldest = timestamps[0]!;
    const waitMs = oldest + WINDOW_MS - now;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  timestamps.push(Date.now());
}

function getApiKey(): string {
  const key = process.env.TASE_API_KEY;
  if (!key) {
    throw new Error(
      "TASE_API_KEY not set. Get your API key at https://openapi.tase.co.il/tase/prod/"
    );
  }
  return key;
}

export interface TaseClientResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}

async function get(
  path: string,
  params?: Record<string, string | number | undefined>,
  lang: string = "he-IL"
): Promise<TaseClientResponse> {
  await rateLimit();

  const apiKey = getApiKey();

  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
        "accept-language": lang,
        apikey: apiKey,
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: `Network error connecting to TASE API: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      error:
        "TASE API rate limit exceeded. Wait a few seconds and try again.",
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      error:
        "TASE API key is invalid or expired. Check your TASE_API_KEY.",
    };
  }

  if (response.status === 500 || response.status === 503) {
    return {
      ok: false,
      error:
        "TASE API is currently unavailable. Trading hours: Sunday-Thursday 9:30-17:00 Israel time.",
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error:
        "TASE API endpoint not found (404). This tool may use an estimated endpoint path. Check https://openapi.tase.co.il for the current API reference.",
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      error: `TASE API returned HTTP ${response.status}: ${body || response.statusText}`,
    };
  }

  const data = await response.json();
  return { ok: true, data };
}

export const taseClient = { get };
