/**
 * IL proxy: forwards railway API calls from AWS il-central-1 so they originate
 * from a Tel Aviv datacenter (which rail-api's Cloudflare WAF allows), instead
 * of from Railway Singapore (which gets 403 blocked).
 */
const API_BASE = "https://rail-api.rail.co.il/rjpa/api/v1";
const RAIL_KEY = "5e64d66cf03f4547bcac5de2de06b566";
const PROXY_KEY = process.env.PROXY_KEY;

export const handler = async (event) => {
  // API Gateway v2 (HTTP API) passes the full event; body is a JSON string.
  try {
    const providedKey = event.headers?.["x-api-key"] || event.headers?.["X-Api-Key"];
    if (!PROXY_KEY || providedKey !== PROXY_KEY) {
      return { statusCode: 401, body: JSON.stringify({ error: "unauthorized" }) };
    }
    const req = JSON.parse(event.body || "{}");
    const endpoint = req.endpoint;
    const body = req.body ?? {};
    if (!endpoint || typeof endpoint !== "string") {
      return { statusCode: 400, body: JSON.stringify({ error: "missing endpoint" }) };
    }

    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ocp-apim-subscription-key": RAIL_KEY,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        Referer: "https://www.rail.co.il/",
        Origin: "https://www.rail.co.il",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    return {
      statusCode: res.status,
      headers: { "Content-Type": "application/json" },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "proxy_error", detail: String(err?.message ?? err) }),
    };
  }
};
