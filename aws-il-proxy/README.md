# aws-il-proxy

A tiny AWS Lambda that forwards HTTPS fetches from Railway (Singapore) to a
curated allowlist of Israeli origins. Its only value-add is that outbound
traffic leaves from AWS `il-central-1` (Tel Aviv), whose IP ranges the
Cloudflare WAFs on `rail-api.rail.co.il` and `prices.carrefour.co.il` accept,
while they 403 requests from Railway's Singapore / EU West egress IPs.

This is a **generic** proxy: it doesn't know or care what the upstream API
looks like. The caller tells it what URL, method, headers, and body to
forward, and it returns the upstream response verbatim. All Israel-specific
knowledge (subscription keys, Referer, rail-api paths) lives in the consuming
MCP.

## Endpoint

```
POST https://rtmxs1cgjc.execute-api.il-central-1.amazonaws.com/
Content-Type: application/json
x-api-key: <PROXY_KEY>

{
  "url":     "https://rail-api.rail.co.il/rjpa/api/v1/timetable/searchTrain",
  "method":  "POST",                              // optional, default "POST"
  "headers": { "Content-Type": "application/json", … },
  "body":    { … JSON forwarded as-is … }         // or a string; ignored for GET
}
```

Response is the upstream's status code + body, with `Content-Type` mirrored
from the upstream response.

## Security

- **Auth**: shared secret in `x-api-key` header; must match the Lambda's
  `PROXY_KEY` env var. Stored on the consuming Railway service as
  `IL_PROXY_KEY`. Rotate by updating both.
- **Allowlist**: hard-coded list of permitted hostnames in `index.mjs`:

  ```js
  const ALLOWLIST = new Set([
    "rail-api.rail.co.il",
    "prices.carrefour.co.il",
  ]);
  ```

  Any other host gets HTTP 403 with `{"error":"domain not allowed"}`. This
  stops the proxy being abused as an open-relay even if `PROXY_KEY` leaks.

## Consumers today

- **`israel-railways-mcp`** — wraps the rail-api fetch. If `IL_PROXY_URL` +
  `IL_PROXY_KEY` env vars are set on the Railway service, routes through
  here; otherwise direct (for local dev from a residential IL IP).
  Source: `../israel-railways-mcp/src/client.ts`.

No other MCP needs the proxy today — their upstreams already accept Railway
IPs. Adding one later is ~30 min of work (see below).

## To add a new upstream later

1. Add the hostname to `ALLOWLIST` in `index.mjs`.
2. `./deploy.sh` to push the new allowlist to Lambda.
3. In the consuming MCP's `client.ts`, make the proxy-routed path send:

   ```ts
   fetch(IL_PROXY_URL, {
     method: "POST",
     headers: { "Content-Type": "application/json", "x-api-key": IL_PROXY_KEY },
     body: JSON.stringify({ url: upstreamUrl, method, headers, body }),
   });
   ```

4. Set `IL_PROXY_URL` + `IL_PROXY_KEY` as Railway variables on that service.

## AWS resources

- Region: `il-central-1`
- Lambda: `rail-probe` (keep the name — it predates the generalization;
  renaming requires recreating the API Gateway integration)
  - Runtime: `nodejs20.x`, arch `arm64`, memory 128 MB, timeout 60 s
  - Env: `PROXY_KEY`
- API Gateway HTTP API: `rail-proxy`, id `rtmxs1cgjc`
  - Single default route → Lambda integration
- IAM execution role: `rail-probe-lambda-role` (with `AWSLambdaBasicExecutionRole`)

## Redeploy

Needs AWS credentials with `lambda:UpdateFunctionCode`:

```bash
export AWS_ACCESS_KEY_ID=…
export AWS_SECRET_ACCESS_KEY=…
./deploy.sh
```

API Gateway doesn't need redeploying — updating the Lambda code is enough.

## Why this exists (architectural rationale)

Long story: rail-api.rail.co.il is Cloudflare-fronted and returns 403 to
AWS / GCP / Azure / Railway datacenter IPs globally. Even explicit Referer
and Origin headers don't help. From Railway Singapore *and* europe-west4
the Rail API returns 403. From AWS il-central-1 it returns 200.

Moving the entire MCP to AWS would be significant refactor (cache
persistence, MCP sessions, Lambda cold starts — see plan file). Running
a narrow egress proxy in AWS IL + keeping the stateful MCP on Railway
keeps the 5 MCPs' architecture intact and adds ~200-500 ms only when IL
egress is actually needed.
