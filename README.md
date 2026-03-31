# Skills-IL MCP Servers

A collection of MCP (Model Context Protocol) servers for Israeli data sources and APIs, maintained by the [skills-il](https://github.com/skills-il) organization.

Browse all MCPs at [agentskills.co.il/mcp](https://agentskills.co.il/he/mcp).

## Available MCPs

| MCP | Description | API | Auth |
|-----|-------------|-----|------|
| [ben-gurion-flights-mcp](./ben-gurion-flights-mcp) | Real-time Ben Gurion Airport flight arrivals and departures | [data.gov.il flydata](https://data.gov.il/dataset/flydata) | None |
| [boi-exchange-mcp](./boi-exchange-mcp) | Bank of Israel official exchange rates (sha'ar yatzig) for 30+ currencies | [BOI SDMX API](https://edge.boi.gov.il/) | None |
| [israel-clinical-trials-mcp](./israel-clinical-trials-mcp) | Clinical trials at Israeli hospitals and research centers | [ClinicalTrials.gov v2 API](https://clinicaltrials.gov/data-api/api) | None |
| [israel-hiking-mcp](./israel-hiking-mcp) | Israel hiking trails, POI search, route planning, and coordinate conversion | [Israel Hiking Map](https://israelhiking.osm.org.il) | None |
| [israel-mental-health-mcp](./israel-mental-health-mcp) | Mental health clinics, quality metrics, and psychiatric services across Israel | [data.gov.il MOH](https://data.gov.il/dataset/mentalhealthclinics) | None |
| [israel-nutrition-mcp](./israel-nutrition-mcp) | Israeli nutrition database (Tzameret) with 4,500+ foods and 74 nutrients | [data.gov.il Tzameret](https://data.gov.il/dataset/nutrition) | None |
| [israel-railways-mcp](./israel-railways-mcp) | Israel Railways train schedules, platforms, occupancy, and service updates | [rail.co.il](https://rail.co.il/) | None |
| [openbus-mcp](./openbus-mcp) | Real-time Israeli public transit data (bus arrivals, route performance, vehicle locations) | [Open Bus Stride API](https://open-bus-stride-api.hasadna.org.il/docs) | None |
| [supermarket-prices-mcp](./supermarket-prices-mcp) | Israeli supermarket price comparison using government-mandated price transparency data | [Price Transparency Law XML feeds](https://github.com/OpenIsraeliSupermarkets) | None |
| [tase-mcp](./tase-mcp) | Tel Aviv Stock Exchange market data (securities, indices, Maya filings) | [TASE Data Hub](https://openapi.tase.co.il/tase/prod/) | API Key |
| [tel-aviv-city-mcp](./tel-aviv-city-mcp) | Tel Aviv municipal data (parking, bike stations, road closures, city services) | [TLV ArcGIS REST](https://gisn.tel-aviv.gov.il/arcgis/rest/services/) | None |

## Structure

Each subdirectory is a standalone MCP server with its own `package.json`, build system, and README:

```
mcps/
  ben-gurion-flights-mcp/    # Ben Gurion Airport flights
  boi-exchange-mcp/          # Bank of Israel exchange rates
  israel-clinical-trials-mcp/ # Clinical trials in Israel
  israel-hiking-mcp/         # Israel hiking trails and route planning
  israel-mental-health-mcp/  # Mental health clinics and services
  israel-nutrition-mcp/      # Israeli nutrition database (Tzameret)
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
