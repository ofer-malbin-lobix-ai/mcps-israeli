#!/usr/bin/env node
/**
 * Israel Vehicle Registry MCP Server
 *
 * Provides access to 4.1M+ Israeli vehicle records from the Ministry of Transport
 * via the data.gov.il DataStore API. No authentication required.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "israel-vehicles-mcp",
  version: "1.0.0",
});

registerTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Israel Vehicle Registry MCP server running via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
