#!/usr/bin/env node
/**
 * Israel Elections MCP Server
 *
 * Provides access to Israeli Knesset election results (Knesset 23, 24, 25)
 * via the data.gov.il DataStore API. No authentication required.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "israel-elections-mcp",
  version: "1.0.0",
});

registerTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Israel Elections MCP server running via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
