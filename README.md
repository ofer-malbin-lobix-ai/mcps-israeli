# Skills-IL MCP Servers

A collection of MCP (Model Context Protocol) servers for Israeli data sources and APIs, maintained by the [skills-il](https://github.com/skills-il) organization.

Browse all MCPs at [agentskills.co.il/mcp](https://agentskills.co.il/he/mcp).

## Available MCPs

| MCP | Description | API | Auth |
|-----|-------------|-----|------|
| [boi-exchange-mcp](./boi-exchange-mcp) | Bank of Israel official exchange rates (sha'ar yatzig) for 30+ currencies | [BOI SDMX API](https://edge.boi.gov.il/) | None |
| [israel-railways-mcp](./israel-railways-mcp) | Israel Railways train schedules, platforms, occupancy, and service updates | [rail.co.il](https://rail.co.il/) | None |
| [tase-mcp](./tase-mcp) | Tel Aviv Stock Exchange market data (securities, indices, Maya filings) | [TASE Data Hub](https://openapi.tase.co.il/tase/prod/) | API Key |
| [openbus-mcp](./openbus-mcp) | Real-time Israeli public transit data (bus arrivals, route performance, vehicle locations) | [Open Bus Stride API](https://open-bus-stride-api.hasadna.org.il/docs) | None |
| [supermarket-prices-mcp](./supermarket-prices-mcp) | Israeli supermarket price comparison using government-mandated price transparency data | [Price Transparency Law XML feeds](https://github.com/OpenIsraeliSupermarkets) | None |
| [tel-aviv-city-mcp](./tel-aviv-city-mcp) | Tel Aviv municipal data (parking, bike stations, road closures, city services) | [TLV ArcGIS REST](https://gisn.tel-aviv.gov.il/arcgis/rest/services/) | None |
| [israel-hiking-mcp](./israel-hiking-mcp) | Israel hiking trails, POI search, route planning, and coordinate conversion | [Israel Hiking Map](https://israelhiking.osm.org.il) | None |

## Structure

Each subdirectory is a standalone MCP server with its own `package.json`, build system, and README:

```
mcps/
  boi-exchange-mcp/          # Bank of Israel exchange rates
  israel-hiking-mcp/         # Israel hiking trails and route planning
  israel-railways-mcp/       # Israel Railways schedules
  openbus-mcp/               # Real-time bus transit data
  supermarket-prices-mcp/    # Supermarket price comparison
  tase-mcp/                  # Tel Aviv Stock Exchange
  tel-aviv-city-mcp/         # Tel Aviv municipal data
```

## Adding a New MCP

Use the `create-mcp-admin` skill in Claude Code to create and deploy a new MCP end-to-end.

## License

Each MCP has its own license. See the LICENSE file in each subdirectory.
