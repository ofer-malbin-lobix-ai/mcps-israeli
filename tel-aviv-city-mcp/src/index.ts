#!/usr/bin/env node

/**
 * Tel Aviv City MCP Server
 *
 * An MCP server that wraps Tel Aviv Municipality's open data APIs
 * (ArcGIS REST services) to provide tools for querying parking,
 * bike stations, road closures, nearby services, and cultural venues.
 *
 * Transport: stdio
 * Auth: None (ArcGIS endpoints are public)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  findParkingSchema,
  findParking,
  getBikeStationsSchema,
  getBikeStations,
  getRoadClosuresSchema,
  getRoadClosures,
  findNearbyServicesSchema,
  findNearbyServices,
  getCityEventsSchema,
  getCityEvents,
} from "./tools.js";

const server = new McpServer({
  name: "tel-aviv-city-mcp",
  version: "1.0.0",
});

// Shared annotations: all tools are read-only queries against a public API.
const readOnlyAnnotations = {
  readOnlyHint: true as const,
  destructiveHint: false as const,
  openWorldHint: true as const,
};

// ---------------------------------------------------------------------------
// Tool: find_parking
// ---------------------------------------------------------------------------

server.tool(
  "find_parking",
  "Find parking lots near a location in Tel Aviv. Returns public parking lots and Ahuzot HaHof municipal parking lots with pricing, capacity, and status information.",
  findParkingSchema.shape,
  readOnlyAnnotations,
  async (input) => {
    try {
      const text = await findParking(input);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error finding parking: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get_bike_stations
// ---------------------------------------------------------------------------

server.tool(
  "get_bike_stations",
  "Find Tel-O-Fun bike sharing stations near a location in Tel Aviv. Shows station name, available bikes, available e-bikes, free docking spots, and Shabbat operation status.",
  getBikeStationsSchema.shape,
  readOnlyAnnotations,
  async (input) => {
    try {
      const text = await getBikeStations(input);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          { type: "text", text: `Error finding bike stations: ${message}` },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get_road_closures
// ---------------------------------------------------------------------------

server.tool(
  "get_road_closures",
  "Get current road works and closures near a location in Tel Aviv. Shows affected streets, type of work, contractor, schedule, lane impact, and estimated dates.",
  getRoadClosuresSchema.shape,
  readOnlyAnnotations,
  async (input) => {
    try {
      const text = await getRoadClosures(input);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          { type: "text", text: `Error getting road closures: ${message}` },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: find_nearby_services
// ---------------------------------------------------------------------------

server.tool(
  "find_nearby_services",
  "Find municipal services near a location in Tel Aviv. Supported service types: pharmacy, school, park, community_center, culture, playground, medical, health_clinic. Returns name, address, distance, phone, hours, and type-specific details.",
  findNearbyServicesSchema.shape,
  readOnlyAnnotations,
  async (input) => {
    try {
      const text = await findNearbyServices(input);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          { type: "text", text: `Error finding services: ${message}` },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get_city_events
// ---------------------------------------------------------------------------

server.tool(
  "get_city_events",
  "Find cultural venues and event locations near a location in Tel Aviv. Returns theaters, galleries, museums, performance halls, and other cultural institutions with their contact info, websites, social media, and domain of activity.",
  getCityEventsSchema.shape,
  readOnlyAnnotations,
  async (input) => {
    try {
      const text = await getCityEvents(input);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          { type: "text", text: `Error getting city events: ${message}` },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
