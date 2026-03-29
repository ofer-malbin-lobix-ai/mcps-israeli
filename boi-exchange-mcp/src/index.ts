#!/usr/bin/env node
/**
 * BOI Exchange MCP Server
 *
 * MCP server for official Bank of Israel exchange rates.
 * Uses the BOI SDMX API to fetch representative rates (sha'ar yatzig)
 * for 30+ currencies against the Israeli New Shekel (ILS).
 *
 * No authentication required - uses public Bank of Israel data.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "boi-exchange-mcp",
  version: "1.0.0",
});

registerTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BOI Exchange MCP server running via stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
