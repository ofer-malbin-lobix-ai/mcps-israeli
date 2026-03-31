#!/usr/bin/env node

/**
 * Ben Gurion Flights MCP Server
 *
 * Real-time flight arrivals and departures at Ben Gurion Airport (TLV)
 * from the official Israel Airports Authority data feed via data.gov.il.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "ben-gurion-flights-mcp",
  version: "1.0.0",
});

registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
