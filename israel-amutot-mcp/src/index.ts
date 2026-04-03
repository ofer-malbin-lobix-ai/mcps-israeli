#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  searchAmuta,
  searchAmutaSchema,
  getAmutaDetails,
  getAmutaDetailsSchema,
  searchByActivity,
  searchByActivitySchema,
  getFinancialInfo,
  getFinancialInfoSchema,
  countAmutot,
  countAmutotSchema,
} from "./tools.js";

const server = new McpServer({
  name: "israel-amutot-mcp",
  version: "1.0.0",
});

// Tool: search_amuta
server.tool(
  "search_amuta",
  "Search Israeli non-profit organizations (amutot) by name (Hebrew or English) or registration number. Returns matching organizations with key details including status, activity classification, and location.",
  searchAmutaSchema.shape,
  {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  async (args) => {
    try {
      const result = await searchAmuta(searchAmutaSchema.parse(args));
      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }
);

// Tool: get_amuta_details
server.tool(
  "get_amuta_details",
  "Get full details of an Israeli non-profit organization (amuta) by its registration number. Returns all available fields including financials, employee count, volunteer count, goals, address, and activity classification.",
  getAmutaDetailsSchema.shape,
  {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  async (args) => {
    try {
      const result = await getAmutaDetails(getAmutaDetailsSchema.parse(args));
      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }
);

// Tool: search_by_activity
server.tool(
  "search_by_activity",
  "Search Israeli non-profit organizations (amutot) by activity classification type, optionally filtered by city. Activity types and city names should be in Hebrew.",
  searchByActivitySchema.shape,
  {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  async (args) => {
    try {
      const result = await searchByActivity(searchByActivitySchema.parse(args));
      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }
);

// Tool: get_financial_info
server.tool(
  "get_financial_info",
  "Get financial information for an Israeli non-profit organization (amuta) by registration number. Returns revenue, expenses, volunteer count, employee count, member count, and last reporting year.",
  getFinancialInfoSchema.shape,
  {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  async (args) => {
    try {
      const result = await getFinancialInfo(getFinancialInfoSchema.parse(args));
      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }
);

// Tool: count_amutot
server.tool(
  "count_amutot",
  "Count Israeli non-profit organizations (amutot) matching optional filter criteria. Filters by status, activity type, and/or city. All filter values should be in Hebrew. Returns total count without fetching records.",
  countAmutotSchema.shape,
  {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  async (args) => {
    try {
      const result = await countAmutot(countAmutotSchema.parse(args));
      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("israel-amutot-mcp server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
