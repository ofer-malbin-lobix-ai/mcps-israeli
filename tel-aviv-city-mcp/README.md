# tel-aviv-city-mcp

An MCP (Model Context Protocol) server that wraps Tel Aviv Municipality's open data APIs. It provides tools for querying real-time city data including parking availability, bike sharing stations, road closures, nearby municipal services, and cultural venues.

## Data Source

All data comes from the Tel Aviv Municipality ArcGIS REST services at `gisn.tel-aviv.gov.il`. These are public endpoints that require no authentication. The data is maintained by the Tel Aviv-Yafo Municipality and updated regularly.

## Tools

### find_parking

Find parking lots near a location in Tel Aviv. Returns both public parking lots and Ahuzot HaHof (municipal) parking lots with pricing, capacity, disability access, and status information.

**Parameters:**
- `longitude` (number, required) - WGS-84 longitude within Tel Aviv (34.7 to 34.85)
- `latitude` (number, required) - WGS-84 latitude within Tel Aviv (32.03 to 32.15)
- `radius_km` (number, optional) - Search radius in km (0.1 to 5, default 1)
- `limit` (number, optional) - Max results (1 to 50, default 10)

### get_bike_stations

Find Tel-O-Fun bike sharing stations near a location. Shows station name, available bikes (regular and electric), free docking spots, and Shabbat operation status.

**Parameters:**
- `longitude` (number, required) - WGS-84 longitude
- `latitude` (number, required) - WGS-84 latitude
- `radius_km` (number, optional) - Search radius in km (default 1)
- `limit` (number, optional) - Max results (default 10)

### get_road_closures

Get current road works and closures near a location. Shows affected streets, type of work, contractor, work schedule (day/night), lane impact, and date range.

**Parameters:**
- `longitude` (number, required) - WGS-84 longitude
- `latitude` (number, required) - WGS-84 latitude
- `radius_km` (number, optional) - Search radius in km (default 2)
- `limit` (number, optional) - Max results (default 10)

### find_nearby_services

Find municipal services near a location. Supports multiple service types with type-specific details.

**Service types:**
- `pharmacy` - Pharmacies with phone, hours, emergency service status
- `school` - Schools with education stage, stream, grade range, phone
- `park` - Public parks and green spaces with area and accessibility
- `community_center` - Community centers with type, website, senior-friendliness
- `culture` - Cultural institutions (museums, theaters, galleries) with domain and contact
- `playground` - Playgrounds with type and accessibility
- `medical` - Medical institutions with phone and type
- `health_clinic` - HMO clinics (Kupot Holim) with phone and HMO name

**Parameters:**
- `longitude` (number, required) - WGS-84 longitude
- `latitude` (number, required) - WGS-84 latitude
- `service_type` (string, required) - One of the service types listed above
- `radius_km` (number, optional) - Search radius in km (default 1)
- `limit` (number, optional) - Max results (default 10)

### get_city_events

Find cultural venues and event locations near a location. Returns theaters, galleries, museums, performance halls, and other cultural institutions with contact info, websites, social media links, and domain of activity.

**Parameters:**
- `longitude` (number, required) - WGS-84 longitude
- `latitude` (number, required) - WGS-84 latitude
- `radius_km` (number, optional) - Search radius in km (default 3)
- `limit` (number, optional) - Max results (default 15)

## Installation

```bash
npm install
npm run build
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tel-aviv-city": {
      "command": "node",
      "args": ["/path/to/tel-aviv-city-mcp/dist/index.js"]
    }
  }
}
```

## Usage with Claude Code

```bash
claude mcp add tel-aviv-city -- node /path/to/tel-aviv-city-mcp/dist/index.js
```

## Development

```bash
npm run dev    # Watch mode
npm run build  # Production build
npm start      # Run server
```

## How It Works

The server queries the Tel Aviv Municipality's ArcGIS MapServer layers using spatial bounding-box queries. All coordinates use WGS-84 (EPSG:4326). Results are sorted by distance from the requested location and returned as formatted text.

### ArcGIS Layers Used

| Layer ID | Name | Description |
|----------|------|-------------|
| 556 | Public Parking | Licensed public parking lots |
| 970 | Ahuzot HaHof Parking | Municipal parking lots with pricing |
| 835 | Tel-O-Fun Stations | Bike sharing station availability |
| 852 | Road Works (lines) | Road closures and construction |
| 853 | Road Works (points) | Point-based road work locations |
| 564 | Pharmacies | Pharmacies with hours and emergency info |
| 769 | Schools | Schools for the current academic year |
| 551 | Parks | Public parks and green spaces |
| 553 | Community Centers | Community centers and libraries |
| 745 | Culture | Museums, theaters, galleries, venues |
| 696 | Playgrounds | Children's playgrounds |
| 565 | Medical Institutions | Hospitals and clinics |
| 563 | Health Clinics | HMO (Kupat Holim) branches |

### Rate Limiting

The client enforces a minimum 200ms interval between requests to avoid overloading the municipal API. Failed requests are retried up to 2 times with exponential backoff.

## Notes

- Location names and addresses are returned in Hebrew (as stored in the municipal database)
- The Tel Aviv ArcGIS coordinate system is Israel Transverse Mercator (ITM, EPSG:2039); the server requests output in WGS-84 for compatibility
- Bike availability data may show -1 when real-time data is temporarily unavailable
- Parking status data from Ahuzot HaHof may not always reflect real-time occupancy

## License

MIT
