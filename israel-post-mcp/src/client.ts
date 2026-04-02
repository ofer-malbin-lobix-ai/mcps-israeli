#!/usr/bin/env node

/**
 * Israel Post API Client
 *
 * Wraps the undocumented Israel Post tracking endpoint.
 * Uses a two-step flow: fetch page for CSRF token + cookies, then POST tracking request.
 *
 * Endpoint: POST /umbraco/Surface/ItemTrace/GetItemTrace
 * Auth: CSRF token + session cookies (auto-extracted)
 */

const BASE_URL = "https://israelpost.co.il";
const TRACKING_PAGE_URL = `${BASE_URL}/itemtrace`;
const TRACKING_API_URL = `${BASE_URL}/umbraco/Surface/ItemTrace/GetItemTrace`;

// Language codes used by Israel Post
const LANG_CODES = {
  he: "1037",
  en: "1033",
} as const;

type Language = keyof typeof LANG_CODES;

export interface TrackingEvent {
  date: string;
  action: string;
  branch: string;
  city: string;
}

export interface TrackingResult {
  trackingNumber: string;
  packageType: string;
  packageTypeName: string;
  events: TrackingEvent[];
  latestStatus: string;
  isDelivered: boolean;
}

export interface TrackingError {
  code: number;
  message: string;
}

interface IsraelPostResponse {
  ReturnCode: number;
  ErrorDescription: string;
  Result: {
    data_type: string;
    typeName: string;
    itemcodeinfo: {
      ColCount: number;
      ColumnHeaders: string[];
      InfoLines: string[][];
    };
  } | null;
}

/**
 * Extract CSRF token and cookies from the Israel Post tracking page.
 */
async function getSessionCredentials(): Promise<{
  csrfToken: string;
  cookies: string;
}> {
  const response = await fetch(TRACKING_PAGE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load tracking page: HTTP ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();

  // Extract CSRF token from hidden input field
  const tokenMatch = html.match(
    /name="__RequestVerificationToken"[^>]*value="([^"]+)"/
  );
  if (!tokenMatch) {
    throw new Error(
      "Could not extract CSRF token from Israel Post tracking page. The site structure may have changed."
    );
  }

  // Extract cookies from response headers
  const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
  const cookies = setCookieHeaders
    .map((c) => c.split(";")[0])
    .join("; ");

  if (!cookies) {
    throw new Error(
      "No session cookies received from Israel Post. The site may be blocking requests."
    );
  }

  return {
    csrfToken: tokenMatch[1],
    cookies,
  };
}

/**
 * Track a package by its tracking number.
 */
export async function trackPackage(
  trackingNumber: string,
  language: Language = "he"
): Promise<TrackingResult> {
  const cleaned = trackingNumber.trim().toUpperCase();

  if (!cleaned) {
    throw new Error("Tracking number cannot be empty");
  }

  // Step 1: Get CSRF token and cookies
  const { csrfToken, cookies } = await getSessionCredentials();

  // Step 2: POST tracking request
  const body = new URLSearchParams({
    itemCode: cleaned,
    lcid: LANG_CODES[language],
    __RequestVerificationToken: csrfToken,
  });

  const response = await fetch(TRACKING_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: TRACKING_PAGE_URL,
      Cookie: cookies,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(
      `Israel Post API returned HTTP ${response.status} ${response.statusText}`
    );
  }

  const data: IsraelPostResponse = await response.json();

  if (data.ReturnCode !== 0) {
    throw new Error(
      data.ErrorDescription || `Israel Post returned error code ${data.ReturnCode}`
    );
  }

  if (!data.Result?.itemcodeinfo) {
    throw new Error("No tracking data returned for this tracking number");
  }

  const { itemcodeinfo } = data.Result;

  // ColCount=1 means error message, not tracking data
  if (itemcodeinfo.ColCount === 1) {
    const errorMsg = itemcodeinfo.InfoLines?.[0]?.[0] ?? "Unknown error";
    throw new Error(`Israel Post: ${errorMsg}`);
  }

  // Parse tracking events from InfoLines (4-column format: date, action, branch, city)
  const events: TrackingEvent[] = (itemcodeinfo.InfoLines ?? []).map(
    (line) => ({
      date: line[0] ?? "",
      action: line[1] ?? "",
      branch: line[2] ?? "",
      city: line[3] ?? "",
    })
  );

  const latestEvent = events[0];
  const latestAction = latestEvent?.action?.toLowerCase() ?? "";
  const isDelivered =
    latestAction.includes("delivered") ||
    latestAction.includes("נמסר");

  return {
    trackingNumber: cleaned,
    packageType: data.Result.data_type,
    packageTypeName: data.Result.typeName,
    events,
    latestStatus: latestEvent?.action ?? "Unknown",
    isDelivered,
  };
}
