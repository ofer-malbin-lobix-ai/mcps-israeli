#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  searchPapers,
  searchPapersSchema,
  getPaperDetails,
  getPaperDetailsSchema,
  searchByInstitution,
  searchByInstitutionSchema,
  getRecentPapers,
  getRecentPapersSchema,
  countPapers,
  countPapersSchema,
} from "./tools.js";

const server = new McpServer({
  name: "israel-medical-research-mcp",
  version: "1.0.0",
});

server.tool(
  "search_papers",
  "Search medical papers from Israeli institutions on PubMed. Returns titles, authors, journals, and PMIDs.",
  searchPapersSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => searchPapers(searchPapersSchema.parse(args))
);

server.tool(
  "get_paper_details",
  "Get detailed information about a specific paper by its PubMed ID (PMID). Returns title, authors, journal, publication date, DOI, and PubMed URL.",
  getPaperDetailsSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => getPaperDetails(getPaperDetailsSchema.parse(args))
);

server.tool(
  "search_by_institution",
  "Search papers from a specific Israeli research institution. Supports institutions like Hadassah, Sheba, Weizmann, Technion, Tel Aviv University, Hebrew University, etc.",
  searchByInstitutionSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => searchByInstitution(searchByInstitutionSchema.parse(args))
);

server.tool(
  "get_recent_papers",
  "Get the most recent medical papers from Israeli institutions. Filter by topic and date range.",
  getRecentPapersSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => getRecentPapers(getRecentPapersSchema.parse(args))
);

server.tool(
  "count_papers",
  "Count the total number of papers matching search criteria from Israeli institutions on PubMed.",
  countPapersSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => countPapers(countPapersSchema.parse(args))
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Israel Medical Research MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
