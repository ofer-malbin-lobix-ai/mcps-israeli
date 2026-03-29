#!/usr/bin/env node
/**
 * Israel Railways MCP Server
 *
 * MCP server for Israel Railways (Rakevet Israel) train schedules,
 * real-time data, and station information. Uses the rail.co.il API.
 *
 * No authentication required.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "israel-railways-mcp",
  version: "1.0.0",
});

registerTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Israel Railways MCP server running via stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
