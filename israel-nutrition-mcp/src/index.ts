#!/usr/bin/env node

/**
 * Israel Nutrition MCP Server
 *
 * Provides access to Israel's National Nutrition Database (Tzameret)
 * with 4,500+ foods and 74 nutritional components per item.
 * Data sourced from the Ministry of Health via data.gov.il.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "israel-nutrition-mcp",
  version: "1.0.0",
});

registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
