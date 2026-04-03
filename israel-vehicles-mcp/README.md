# Israel Vehicle Registry MCP Server

MCP server for the Israeli Vehicle Registry (Ministry of Transport). Look up any vehicle by license plate, search by manufacturer or model, check roadworthiness test status, and get fleet statistics across 4.1M+ registered vehicles.

Data source: [data.gov.il](https://data.gov.il/) CKAN DataStore API. No API key required.

## Tools

| Tool | Description |
|------|-------------|
| `search_vehicle` | Look up a vehicle by license plate number |
| `search_by_model` | Search by manufacturer, commercial name, year, or fuel type |
| `get_vehicle_stats` | Fleet statistics grouped by year, fuel type, manufacturer, color, or ownership |
| `get_test_status` | Check if a vehicle's annual roadworthiness test is current or expired |
| `list_manufacturers` | List all manufacturers with vehicle counts |

## Installation

### Claude Desktop / Claude Code

Add to your MCP config:

```json
{
  "mcpServers": {
    "israel-vehicles": {
      "command": "npx",
      "args": ["-y", "israel-vehicles-mcp"]
    }
  }
}
```

### From source

```bash
git clone https://github.com/skills-il/mcps.git
cd mcps/israel-vehicles-mcp
npm install
npm run build
node dist/index.js
```

## API Details

- **Data source**: Israeli Vehicle Registry via [data.gov.il DataStore API](https://data.gov.il/dataset/private-and-commercial-vehicles)
- **Records**: 4.1M+ private and commercial vehicles
- **Authentication**: None required
- **Rate limits**: Client-side throttling (200ms between requests)
- **Fields**: License plate, manufacturer, model, year, fuel type, color, safety rating, emissions group, test dates, chassis number, tire sizes, and more

## License

MIT
