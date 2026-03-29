# israel-hiking-mcp

An MCP (Model Context Protocol) server that wraps the [Israel Hiking Map](https://israelhiking.osm.org.il/) APIs, providing route planning, POI search, trail discovery, and coordinate conversion for Israel.

The Israel Hiking Map is an open-source project built on OpenStreetMap data, maintained by the Israeli hiking community.

## Tools

### search_pois

Search for points of interest in Israel by name or keyword. Returns locations of hiking trails, water sources, viewpoints, campgrounds, historical sites, and more from OpenStreetMap and Wikidata. Supports Hebrew and English search terms.

**Parameters:**
- `query` (string, required) - Search term in Hebrew or English (e.g., "Ein Gedi", "water", "viewpoint")
- `language` (string, optional) - Language for results: "he" (default) or "en"

### plan_route

Plan a route between two geographic points in Israel. Returns distance, elevation profile (ascent, descent, min/max elevation), and road type breakdown.

**Parameters:**
- `from_lat` (number, required) - Start point latitude (WGS84)
- `from_lng` (number, required) - Start point longitude (WGS84)
- `to_lat` (number, required) - End point latitude (WGS84)
- `to_lng` (number, required) - End point longitude (WGS84)
- `route_type` (string, optional) - Routing profile: "Hike" (default), "Bike", "4WD", or "None"

### find_trails

Search for hiking trails and routes near a given location in Israel. Filters results to show trail-related POIs.

**Parameters:**
- `area` (string, required) - Area or place name (e.g., "Galilee", "Negev", "Golan")
- `language` (string, optional) - Language for results: "he" (default) or "en"

### get_poi_details

Get detailed information about a specific point of interest. Requires the source and ID from a previous search result. Returns multilingual names, location, elevation, category, Wikipedia links, images, and more.

**Parameters:**
- `source` (string, required) - Data source: "OSM" or "Wikidata"
- `id` (string, required) - Unique identifier within the source (e.g., "node_29090735", "Q1218")

### convert_coordinates

Convert coordinates between Israel Transverse Mercator (ITM) and WGS84 coordinate systems. ITM is the official Israeli coordinate system used in local maps and surveys. WGS84 is the global GPS standard.

**Parameters:**
- `direction` (string, required) - "itm_to_wgs84" or "wgs84_to_itm"
- `x` (number, required) - For ITM to WGS84: Easting. For WGS84 to ITM: Latitude.
- `y` (number, required) - For ITM to WGS84: Northing. For WGS84 to ITM: Longitude.

## Setup

### Install

```bash
npm install
npm run build
```

### Configure with Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "israel-hiking": {
      "command": "node",
      "args": ["/path/to/israel-hiking-mcp/dist/index.js"]
    }
  }
}
```

### Configure with Claude Code

```bash
claude mcp add israel-hiking node /path/to/israel-hiking-mcp/dist/index.js
```

## API Source

All data comes from the [Israel Hiking Map](https://israelhiking.osm.org.il/) public API, which is built on [OpenStreetMap](https://www.openstreetmap.org/) data. The server implements client-side rate limiting (minimum 500ms between requests) and request timeouts to be respectful to the open-source infrastructure.

## License

MIT
