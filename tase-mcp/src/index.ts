#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "tase-mcp",
  version: "1.0.0",
  description:
    "MCP server for Tel Aviv Stock Exchange (TASE) market data. Provides access to securities, indices, company announcements, and management data via the official TASE Data Hub API.",
});

registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
