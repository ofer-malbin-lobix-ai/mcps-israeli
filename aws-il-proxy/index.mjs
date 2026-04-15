/**
 * Generic IL-egress fetch proxy.
 *
 * Runs in AWS il-central-1 (Tel Aviv). Accepts a signed POST from any of
 * our Railway MCPs and forwards the embedded fetch request to the real
 * upstream, returning the status + body verbatim. The value-add is solely
 * that the outbound request originates from an AWS IL IP — which Cloudflare
 * WAFs on several Israeli origins (rail-api.rail.co.il, prices.carrefour.co.il)
 * trust, while they block Railway Singapore / EU West IPs with 403.
 *
 * Wire format (POST JSON):
 *   {
 *     url:      string,                      // required, full upstream URL
 *     method?:  "GET" | "POST" | "PUT" | …,  // default "POST"
 *     headers?: Record<string,string>,       // merged over sensible defaults
 *     body?:    any                          // stringified if object, passed
 *                                            //   through if string, skipped
 *                                            //   for GET
 *   }
 *
 * Auth: shared secret in `x-api-key` header, matched against PROXY_KEY env var.
 * Allowlist: URL host must be in ALLOWLIST to stop random open-proxy use.
 */

const PROXY_KEY = process.env.PROXY_KEY;

// Hosts this proxy may forward to. Keep tight — add a host here (and redeploy)
// when a new MCP needs IL egress for an upstream that blocks Railway.
const ALLOWLIST = new Set([
  "rail-api.rail.co.il",
  "prices.carrefour.co.il",
]);

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
};

function respond(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: typeof obj === "string" ? obj : JSON.stringify(obj),
  };
}

export const handler = async (event) => {
  try {
    const providedKey =
      event.headers?.["x-api-key"] ?? event.headers?.["X-Api-Key"];
    if (!PROXY_KEY || providedKey !== PROXY_KEY) {
      return respond(401, { error: "unauthorized" });
    }

    const req = JSON.parse(event.body || "{}");
    if (!req.url || typeof req.url !== "string") {
      return respond(400, { error: "missing url" });
    }

    let parsed;
    try { parsed = new URL(req.url); }
    catch { return respond(400, { error: "invalid url" }); }

    if (!ALLOWLIST.has(parsed.hostname)) {
      return respond(403, {
        error: "domain not allowed",
        host: parsed.hostname,
        allowlist: [...ALLOWLIST],
      });
    }

    const method = (req.method ?? "POST").toUpperCase();
    const headers = { ...DEFAULT_HEADERS, ...(req.headers ?? {}) };
    const hasBody = method !== "GET" && method !== "HEAD" && req.body !== undefined;
    const body = !hasBody
      ? undefined
      : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body);

    const upstream = await fetch(req.url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(20000),
    });

    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
      body: text,
    };
  } catch (err) {
    return respond(502, {
      error: "proxy_error",
      detail: String(err?.message ?? err).slice(0, 300),
    });
  }
};
