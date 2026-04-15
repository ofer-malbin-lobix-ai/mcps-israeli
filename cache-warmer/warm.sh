#!/bin/sh
# Periodically calls find_product on the supermarket-prices-mcp server so that
# the MCP container's in-memory XML cache stays warm (2h TTL). Without this,
# the first real WhatsApp user after idle pays the full ~45s cold-fetch cost.

set -eu

MCP="${MCP_URL:-https://supermarket-prices-mcp-production.up.railway.app/mcp}"
QUERY="${WARM_QUERY:-קוקה קולה 1.5}"

echo "[warmer] hitting $MCP with query=$QUERY"
START=$(date +%s)

# Step 1: initialize MCP session, capture the session id from the response headers.
HEADERS=$(mktemp)
curl -fsS -D "$HEADERS" -o /dev/null -X POST "$MCP" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"cache-warmer","version":"1"}}}'

SID=$(awk 'tolower($1)=="mcp-session-id:"{print $2}' "$HEADERS" | tr -d '\r' | head -1)
rm -f "$HEADERS"

if [ -z "$SID" ]; then
  echo "[warmer] ERROR: no mcp-session-id returned"
  exit 1
fi

# Step 2: notifications/initialized (required before tool calls).
curl -fsS -o /dev/null -X POST "$MCP" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# Step 3: the tool call that actually warms the cache.
curl -fsS -X POST "$MCP" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SID" \
  --max-time 120 \
  -d "$(printf '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"find_product","arguments":{"query":"%s","limit":1}}}' "$QUERY")" \
  > /dev/null

echo "[warmer] done in $(($(date +%s)-START))s"
