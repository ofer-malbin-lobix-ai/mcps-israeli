# ben-gurion-flights-mcp

An MCP (Model Context Protocol) server providing real-time flight arrivals and departures at Ben Gurion Airport (TLV). Data comes from the official Israel Airports Authority feed published on data.gov.il, updated every 15 minutes.

## Tools

| Tool | Description |
|------|-------------|
| `get_arrivals` | Get current arriving flights. Filter by airline, origin city, or status. |
| `get_departures` | Get current departing flights. Filter by airline, destination city, or status. |
| `get_flight_status` | Look up a specific flight by number (e.g. "LY1626"). |
| `search_flights` | Free-text search across all flight fields. Works in Hebrew and English. |
| `get_airport_summary` | Summary statistics: total arrivals/departures, counts by airline, status, and country. |

## Installation

### Using npx (recommended)

```json
{
  "mcpServers": {
    "ben-gurion-flights": {
      "command": "npx",
      "args": ["-y", "ben-gurion-flights-mcp"]
    }
  }
}
```

### Manual installation

```bash
git clone https://github.com/skills-il/ben-gurion-flights-mcp.git
cd ben-gurion-flights-mcp
npm install
npm run build
```

Then add to your MCP client config:

```json
{
  "mcpServers": {
    "ben-gurion-flights": {
      "command": "node",
      "args": ["/path/to/ben-gurion-flights-mcp/dist/index.js"]
    }
  }
}
```

## Data Source

Flight data is provided by the **Israel Airports Authority** via the [data.gov.il](https://data.gov.il) open data portal (CKAN Datastore API). No API key or authentication is required. Data is updated every 15 minutes.

- Resource ID: `e83f763b-b7d7-479e-b172-ae981ddc6de5`
- API endpoint: `https://data.gov.il/api/3/action/datastore_search`

## License

MIT
