# openbus-mcp

An MCP (Model Context Protocol) server that wraps the [Open Bus Stride API](https://open-bus-stride-api.hasadna.org.il/docs) by [The Public Knowledge Workshop (Hasadna)](https://www.hasadna.org.il/). Provides AI agents with access to Israeli public transit data including real-time arrivals, ride performance, routes, stops, timetables, vehicle locations, and transit agencies.

## Features

- 7 tools covering the core Open Bus Stride API endpoints
- Client-side rate limiting (1 request/second)
- No authentication required (free, open API)
- Formatted text output (not raw JSON)
- Zod schema validation on all inputs

## Tools

| Tool | Description |
|------|-------------|
| `get_stop_arrivals` | Real-time arrival data at a specific stop |
| `get_ride_performance` | Planned vs actual ride comparison (delays, adherence) |
| `search_routes` | Search planned GTFS routes by operator, line, name |
| `find_stops` | Find transit stops by code or city |
| `get_route_timetable` | Planned departure timetables |
| `get_vehicle_locations` | Real-time vehicle positions in a geographic area |
| `list_agencies` | Israeli transit operators (Egged, Dan, etc.) |

## Installation

### Claude Code

```bash
claude mcp add openbus-mcp -- node /path/to/openbus-mcp/dist/index.js
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openbus-mcp": {
      "command": "node",
      "args": ["/path/to/openbus-mcp/dist/index.js"]
    }
  }
}
```

### Cursor

Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "openbus-mcp": {
      "command": "node",
      "args": ["/path/to/openbus-mcp/dist/index.js"]
    }
  }
}
```

## Build from source

```bash
npm install
npm run build
```

## Example queries

- "What buses are arriving at stop 12345 right now?"
- "How is Egged line 480 performing this week? Show me delays."
- "Find all bus stops in Jerusalem."
- "List all transit agencies active today."
- "Show me real-time bus locations in Tel Aviv."

## API Reference

This server wraps the Open Bus Stride API. Full API documentation is available at:
https://open-bus-stride-api.hasadna.org.il/docs

## License

MIT
