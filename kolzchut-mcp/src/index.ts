#!/usr/bin/env node
/**
 * Kolzchut MCP Server
 *
 * Provides AI agents with access to Kolzchut (כל-זכות / All-Rights),
 * Israel's authoritative knowledge base for rights and entitlements.
 * Covers topics including new immigrants (olim), tax benefits, housing,
 * health insurance, employment, disability, and more.
 *
 * API: https://www.kolzchut.org.il/w/api.php (public, no auth needed)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "kolzchut-mcp-server",
  version: "1.0.0",
});

registerTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Kolzchut MCP server running via stdio");
}

main().catch((error) => {
  console.error("Failed to start Kolzchut MCP server:", error);
  process.exit(1);
});
