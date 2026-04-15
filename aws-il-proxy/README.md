# aws-il-proxy

A tiny AWS Lambda that forwards requests from Railway (Singapore) to
`rail-api.rail.co.il`. rail-api is fronted by Cloudflare with a WAF that
rejects most cloud-datacenter IPs (both `asia-southeast1` and `europe-west4`
Railway regions return 403). AWS `il-central-1` (Tel Aviv) IPs are on the
WAF's allowlist, so we run this Lambda there and have `israel-railways-mcp`
route all its rail-api calls through it.

## Endpoint

```
POST https://rtmxs1cgjc.execute-api.il-central-1.amazonaws.com/
Content-Type: application/json
x-api-key: <PROXY_KEY>

{ "endpoint": "timetable/searchTrain", "body": { ... rail-api JSON ... } }
```

`endpoint` is the path after `rjpa/api/v1/` on rail-api. `body` is the
request JSON; the Lambda adds Referer / Origin / subscription-key headers.
Response is the raw upstream status + body.

## Consumers

- `israel-railways-mcp` on Railway — sets `IL_PROXY_URL` and `IL_PROXY_KEY`
  env vars. Logic lives in `../israel-railways-mcp/src/client.ts`; if both
  vars are set, the MCP proxies through; otherwise direct fetch (for local
  dev from a residential IL IP).

## Config

- AWS region: `il-central-1`
- Lambda function: `rail-probe` (runtime `nodejs20.x`, arch `arm64`, mem 128 MB, timeout 60 s)
- API Gateway HTTP API: `rail-proxy` (id `rtmxs1cgjc`)
- Lambda env var: `PROXY_KEY` — shared secret between Lambda and consumer
  services. Current value lives in Railway on the `israel-railways-mcp` service
  as `IL_PROXY_KEY`. Rotate by updating both.

## Redeploy

Needs AWS credentials with `lambda:UpdateFunctionCode` (e.g. the
`mcps-israeli` IAM user's access key).

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
./deploy.sh
```

That's it — API Gateway doesn't need redeploying; updating the Lambda
function code is enough.

## Why not just run the whole MCP in il-central-1?

See the plan file for the full analysis. Short answer: the MCPs rely on
long-lived in-memory caches (XML files, Kaggle snapshot) that break badly
under Lambda's per-invocation container model. Moving the whole MCP to
Lambda would force 20-40 s cold paths on many user calls. The current
hybrid (Railway for stateful MCPs, Lambda for narrow IL-egress proxying)
keeps cold UX at ~2 s and infra cost at ~$5/mo.
