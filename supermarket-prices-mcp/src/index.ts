#!/usr/bin/env node

/**
 * supermarket-prices-mcp
 *
 * An MCP server providing access to Israeli supermarket price data from the
 * government-mandated Price Transparency Law (2014 Food Act).
 *
 * Under this law, all supermarket chains with 3+ stores must publish product
 * prices, promotions, and store information as XML files daily. This server
 * provides tools to browse, search, and compare this publicly available data.
 *
 * Data sources:
 * - Direct web access to Shufersal and PublishPrice-based chains
 * - FTP guidance for Cerberus-based chains (url.retail.publishedprices.co.il)
 * - Kaggle dataset reference (erlichsefi/israeli-supermarkets-2024)
 * - OpenIsraeliSupermarkets community project reference
 *
 * Transport: stdio
 * Auth: None required (all data is publicly mandated)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "supermarket-prices-mcp",
  version: "1.0.0",
});

registerTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting supermarket-prices-mcp:", err);
  process.exit(1);
});
