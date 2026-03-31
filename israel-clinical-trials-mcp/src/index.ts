#!/usr/bin/env node

/**
 * Israel Clinical Trials MCP Server
 *
 * Search active and completed clinical trials at Israeli hospitals
 * and research centers via the ClinicalTrials.gov v2 API.
 *
 * DISCLAIMER: This tool is for informational purposes only and does not
 * constitute medical advice. Always consult qualified healthcare providers
 * for medical decisions.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  searchTrialsSchema,
  getTrialDetailsSchema,
  findTrialsByHospitalSchema,
  listRecruitingTrialsSchema,
  getTrialLocationsSchema,
  handleSearchTrials,
  handleGetTrialDetails,
  handleFindTrialsByHospital,
  handleListRecruitingTrials,
  handleGetTrialLocations,
} from "./tools.js";

const server = new McpServer({
  name: "israel-clinical-trials-mcp",
  version: "1.0.0",
});

// ── Tool: search_trials ──
server.tool(
  "search_trials",
  "Search clinical trials in Israel by condition, keyword, or intervention. Returns NCT ID, title, status, conditions, sponsor, phases, and key dates.",
  searchTrialsSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => {
    try {
      const text = await handleSearchTrials(searchTrialsSchema.parse(args));
      return { content: [{ type: "text", text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error searching trials: ${message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: get_trial_details ──
server.tool(
  "get_trial_details",
  "Get full details for a specific clinical trial by NCT ID, including eligibility criteria, description, interventions, locations, and contacts.",
  getTrialDetailsSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => {
    try {
      const text = await handleGetTrialDetails(getTrialDetailsSchema.parse(args));
      return { content: [{ type: "text", text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          { type: "text", text: `Error fetching trial details: ${message}` },
        ],
        isError: true,
      };
    }
  }
);

// ── Tool: find_trials_by_hospital ──
server.tool(
  "find_trials_by_hospital",
  'Find clinical trials at a specific Israeli hospital or institution (e.g. "Sheba", "Hadassah", "Ichilov", "Rambam").',
  findTrialsByHospitalSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => {
    try {
      const text = await handleFindTrialsByHospital(
        findTrialsByHospitalSchema.parse(args)
      );
      return { content: [{ type: "text", text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error searching hospital trials: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ── Tool: list_recruiting_trials ──
server.tool(
  "list_recruiting_trials",
  "List all currently recruiting clinical trials in Israel, optionally filtered by medical condition. Results sorted by most recently updated.",
  listRecruitingTrialsSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => {
    try {
      const text = await handleListRecruitingTrials(
        listRecruitingTrialsSchema.parse(args)
      );
      return { content: [{ type: "text", text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error listing recruiting trials: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ── Tool: get_trial_locations ──
server.tool(
  "get_trial_locations",
  "Get all Israeli locations and contact information for a specific clinical trial by NCT ID.",
  getTrialLocationsSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => {
    try {
      const text = await handleGetTrialLocations(
        getTrialLocationsSchema.parse(args)
      );
      return { content: [{ type: "text", text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          { type: "text", text: `Error fetching trial locations: ${message}` },
        ],
        isError: true,
      };
    }
  }
);

// ── Start server ──
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
