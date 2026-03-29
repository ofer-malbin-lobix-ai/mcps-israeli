#!/usr/bin/env node

/**
 * Israel Hiking Map MCP Server
 *
 * Wraps the Israel Hiking Map APIs (israelhiking.osm.org.il) to provide
 * route planning, POI search, trail discovery, and coordinate conversion
 * tools via the Model Context Protocol.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

function createServer(): McpServer {
  const server = new McpServer({
    name: "israel-hiking-mcp",
    version: "1.0.0",
  });

  registerTools(server);

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start Israel Hiking MCP server:", err);
  process.exit(1);
});
