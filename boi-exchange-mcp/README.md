# BOI Exchange MCP

MCP server for official Bank of Israel exchange rates. Access daily representative rates (sha'ar yatzig) for 30+ currencies against the Israeli New Shekel (ILS) via the official BOI SDMX API.

No API key required.

## Tools

| Tool | Description |
|------|-------------|
| `get_exchange_rate` | Get the latest representative exchange rate for a currency against ILS |
| `get_historical_rates` | Get daily rates over a date range |
| `list_currencies` | List all supported currency codes |
| `get_rate_change` | Calculate rate change (absolute and percentage) between two dates |
| `convert_currency` | Convert an amount between ILS and another currency using the latest official rate |

## Setup

### Claude Desktop / Claude Code

Add to your MCP config:

```json
{
  "mcpServers": {
    "boi-exchange": {
      "command": "npx",
      "args": ["-y", "boi-exchange-mcp"]
    }
  }
}
```

### From source

```bash
git clone https://github.com/skills-il/mcps.git
cd mcps/boi-exchange-mcp
npm install
npm run build
```

Then add to your MCP config:

```json
{
  "mcpServers": {
    "boi-exchange": {
      "command": "node",
      "args": ["/path/to/boi-exchange-mcp/dist/index.js"]
    }
  }
}
```

## API Reference

This MCP wraps the Bank of Israel SDMX series database:

- **Base URL**: `https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0`
- **Data browser**: https://edge.boi.gov.il/FusionDataBrowser/?df=BOI.STATISTICS:EXR(1.0)
- **Documentation**: https://www.boi.org.il/en/economic-roles/statistics/
- **Auth**: None (public API)
- **Rate publishing schedule**: Sunday through Thursday (Israeli business days)

## Examples

**"What's the dollar rate today?"**
Calls `get_exchange_rate` with `currency: "USD"`.

**"Show me EUR/ILS for the last month"**
Calls `get_historical_rates` with `currency: "EUR"`, date range for the past 30 days.

**"Convert 1000 USD to shekels"**
Calls `convert_currency` with `amount: 1000`, `fromCurrency: "USD"`, `toCurrency: "ILS"`.

**"How much did the dollar change this year?"**
Calls `get_rate_change` with `currency: "USD"`, from Jan 1 to today.

## License

MIT
