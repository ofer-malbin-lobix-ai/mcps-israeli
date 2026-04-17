#!/usr/bin/env node

/**
 * Tel Aviv City MCP Server
 *
 * An MCP server that wraps Tel Aviv Municipality's open data APIs
 * (ArcGIS REST services) to provide tools for querying parking,
 * bike stations, road closures, nearby services, and cultural venues.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
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

const SERVER_NAME = "tel-aviv-city-mcp";
const SERVER_VERSION = "1.0.0";

const readOnlyAnnotations = {
  readOnlyHint: true as const,
  destructiveHint: false as const,
  openWorldHint: true as const,
};

function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.tool("find_parking", "Find parking lots near a location in Tel Aviv. Returns public parking lots and Ahuzot HaHof municipal parking lots with pricing, capacity, and status information.", findParkingSchema.shape, readOnlyAnnotations, async (input) => {
    try { return { content: [{ type: "text", text: await findParking(input) }] }; }
    catch (err) { return { content: [{ type: "text", text: `Error finding parking: ${err instanceof Error ? err.message : String(err)}` }], isError: true }; }
  });

  server.tool("get_bike_stations", "Find Tel-O-Fun bike sharing stations near a location in Tel Aviv. Shows station name, available bikes, available e-bikes, free docking spots, and Shabbat operation status.", getBikeStationsSchema.shape, readOnlyAnnotations, async (input) => {
    try { return { content: [{ type: "text", text: await getBikeStations(input) }] }; }
    catch (err) { return { content: [{ type: "text", text: `Error finding bike stations: ${err instanceof Error ? err.message : String(err)}` }], isError: true }; }
  });

  server.tool("get_road_closures", "Get current road works and closures near a location in Tel Aviv. Shows affected streets, type of work, contractor, schedule, lane impact, and estimated dates.", getRoadClosuresSchema.shape, readOnlyAnnotations, async (input) => {
    try { return { content: [{ type: "text", text: await getRoadClosures(input) }] }; }
    catch (err) { return { content: [{ type: "text", text: `Error getting road closures: ${err instanceof Error ? err.message : String(err)}` }], isError: true }; }
  });

  server.tool("find_nearby_services", "Find municipal services near a location in Tel Aviv. Supported service types: pharmacy, school, park, community_center, culture, playground, medical, health_clinic.", findNearbyServicesSchema.shape, readOnlyAnnotations, async (input) => {
    try { return { content: [{ type: "text", text: await findNearbyServices(input) }] }; }
    catch (err) { return { content: [{ type: "text", text: `Error finding services: ${err instanceof Error ? err.message : String(err)}` }], isError: true }; }
  });

  server.tool("get_city_events", "Find cultural venues and event locations near a location in Tel Aviv. Returns theaters, galleries, museums, performance halls, and other cultural institutions.", getCityEventsSchema.shape, readOnlyAnnotations, async (input) => {
    try { return { content: [{ type: "text", text: await getCityEvents(input) }] }; }
    catch (err) { return { content: [{ type: "text", text: `Error getting city events: ${err instanceof Error ? err.message : String(err)}` }], isError: true }; }
  });

  return server;
}

async function runStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function runHttp() {
  const app = express();
  app.use(express.json());

  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.get("/health", (_req, res) => { res.status(200).send("ok"); });

  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => { transports.set(id, transport!); },
      });
      transport.onclose = () => { if (transport!.sessionId) transports.delete(transport!.sessionId); };
      const server = createServer();
      await server.connect(transport);
    }
    await transport.handleRequest(req, res, req.body);
  });

  const handleSession = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) { res.status(400).send("Invalid or missing mcp-session-id"); return; }
    await transport.handleRequest(req, res);
  };
  app.get("/mcp", handleSession);
  app.delete("/mcp", handleSession);

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => { console.error(`${SERVER_NAME} listening on :${port}/mcp`); });
}

const main = process.env.PORT ? runHttp : runStdio;
main().catch((err) => { console.error("Fatal error:", err); process.exit(1); });
